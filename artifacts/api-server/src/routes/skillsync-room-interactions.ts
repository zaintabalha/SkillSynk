import { Router, type IRouter, type RequestHandler } from "express";
import {
  SendSkillSyncMessageBody, SendSkillSyncMessageResponse,
  GenerateSkillSyncActivityBody, GenerateSkillSyncActivityResponse,
  SubmitSkillSyncActivityAttemptBody, SubmitSkillSyncActivityAttemptResponse,
  ListSkillSyncActivitiesResponse, RequestSkillSyncCallCopilotBody, RequestSkillSyncCallCopilotResponse,
} from "@workspace/api-zod";
import {
  db, skillSyncMessagesTable as messages, skillSyncActivitiesTable as activities,
  skillSyncActivityAttemptsTable as attempts,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { roomContext, resolveSpeaker, roomMemory, messageDto, roomActivities, attemptDto, recordAiUse, type RoomContext } from "../lib/skillsync-room-service";
import { answerRoomQuestion, generateCallCopilotText, generateCallSummary, generateRoomActivity } from "../lib/skillsync-room-ai";
import { withAiBudget } from "../lib/skillsync-ai-limits";
import { logger } from "../lib/logger";

const router: IRouter = Router();
type Kind = "quiz" | "flashcards" | "simulator";
export function explicitlyInvokesAi(content: string, replyId?: string | null) {
  return Boolean(replyId) || /(^|\s)@(AI|SkillSync)(?=$|[\s,.!?،:])/iu.test(content);
}
export function requestedActivity(content: string): Kind | null {
  // Mentioning a flashcard/quiz while asking for an explanation is not a generation request.
  const explicitRequest = /\b(create|generate|make|give|build|prepare|start)\b|أنشئ|انشئ|اصنع|أعط|اعط|جهز|جهّز|أعد|اعد|اعمل/iu.test(content);
  const shortRequest = /^\s*(?:@(?:AI|SkillSync)\s+)?(?:a\s+)?(?:quiz|flashcards?|simulator)(?:\s+please)?[.!?]?\s*$/iu.test(content);
  if (!explicitRequest && !shortRequest) return null;
  if (/quiz|كويز|اختبار/iu.test(content)) return "quiz";
  if (/flash\s*cards?|بطاقات/iu.test(content)) return "flashcards";
  if (/simulat|محاكا/iu.test(content)) return "simulator";
  return null;
}
function recordAiUseNonBlocking(context: RoomContext, userId: string, feature: string, aiPowered: boolean) {
  void (async () => {
    try {
      await recordAiUse(userId, feature, aiPowered, context.room.isDemo);
    } catch (error) {
      logger.warn(
        { err: error, feature, roomId: context.room.id },
        "AI usage telemetry failed; continuing the user request",
      );
    }
  })();
}
async function createActivity(context: RoomContext, kind: Kind, prompt: string, userId: string, transcript?: string) {
  const activityPrompt = transcript ? `${prompt}\n\nRecent call transcript to use as source material:\n${transcript}` : prompt;
  const generated = await generateRoomActivity(kind, activityPrompt, await roomMemory(context));
  const id = randomUUID();
  await db.insert(activities).values({
    id, roomId: context.room.id, kind, title: generated.title, instructions: generated.instructions,
    content: generated.content, createdBy: userId, isDemo: !generated.aiPowered,
  });
  recordAiUseNonBlocking(context, userId, kind, generated.aiPowered);
  const activity = (await roomActivities(context.room.id)).find((item) => item.id === id)!;
  return { activity, aiPowered: generated.aiPowered };
}
function sendChat(channel: "partner" | "ai"): RequestHandler {
  return async (req, res) => {
    const body = SendSkillSyncMessageBody.safeParse(req.body);
    if (!body.success || !body.data.content.trim()) { res.status(400).json({ error: "Enter a message." }); return; }
    const context = await roomContext(String(req.params.roomId), res.locals.userId);
    if (!context) { res.status(404).json({ error: "Room not found." }); return; }
    if (context.room.status === "unmatched") { res.status(409).json({ error: "This pair has been unmatched. The transcript is read-only." }); return; }
    let speaker;
    try { speaker = resolveSpeaker(context, res.locals.userId, body.data.simulatedUserId); }
    catch (error) { res.status(403).json({ error: (error as Error).message }); return; }
    const [quote] = body.data.replyToMessageId
      ? await db.select().from(messages).where(and(eq(messages.id, body.data.replyToMessageId), eq(messages.roomId, context.room.id)))
      : [];
    if (body.data.replyToMessageId && !quote) { res.status(400).json({ error: "Quoted message is not in this room." }); return; }
    const invokesAi = channel === "ai" || explicitlyInvokesAi(body.data.content.trim(), quote?.id);
    const send = async () => {
      const prompt = body.data.content.trim();
      let assistantMessage = null;
      let aiPowered = false;
      let content: string | null = null;
      let activityId: string | null = null;
      // Ordinary partner messages never enter the AI budget or load AI memory.
      if (invokesAi) {
        const kind = quote ? null : requestedActivity(prompt);
        if (kind) {
          const result = await createActivity(context, kind, prompt, res.locals.userId);
          activityId = result.activity.id;
          aiPowered = result.aiPowered;
          content = /[\u0600-\u06ff]/.test(prompt)
            ? "أعددت نشاطاً مشتركاً لكما. افتحا تبويب الكويزات والمحاكيات للبدء."
            : "I created a shared activity for you both. Open Quizzes & Simulators to begin.";
        } else {
          const result = await answerRoomQuestion(prompt, await roomMemory(context), quote?.content);
          content = result.answer;
          aiPowered = result.aiPowered;
          recordAiUseNonBlocking(context, res.locals.userId, quote ? "verification" : "shared_chat", aiPowered);
        }
      }
      // Save only after admission, including provider admission, so 429 retries do not duplicate messages.
      const [saved] = await db.insert(messages).values({
        id: randomUUID(), roomId: context.room.id, senderId: speaker.userId, senderName: speaker.displayName,
        senderType: "student", channel, content: prompt, replyToMessageId: quote?.id ?? null,
      }).returning();
      if (content !== null) {
        const [response] = await db.insert(messages).values({
          id: randomUUID(), roomId: context.room.id, senderId: null, senderName: "SkillSync AI",
          senderType: "assistant", channel, content, activityId, replyToMessageId: quote?.id ?? saved.id,
        }).returning();
        assistantMessage = messageDto(response);
      }
      res.status(201).json(SendSkillSyncMessageResponse.parse({ message: messageDto(saved), assistantMessage, aiPowered }));
    };
    if (invokesAi) {
      await withAiBudget(send, { userId: res.locals.userId, roomId: context.room.id });
    } else {
      await send();
    }
  };
}
router.post("/skillsync/rooms/:roomId/messages", sendChat("partner"));
router.post("/skillsync/rooms/:roomId/ai-messages", sendChat("ai"));
router.post("/skillsync/rooms/:roomId/call-copilot", async (req, res) => {
  const body = RequestSkillSyncCallCopilotBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  if (body.data.action !== "speaking_prompt" && !body.data.transcript.trim()) {
    res.status(400).json({ error: "Add or transcribe a little call conversation first." }); return;
  }
  const result = await withAiBudget(async () => {
    const memory = await roomMemory(context);
    if (body.data.action === "speaking_prompt" || body.data.action === "hint") {
      const answer = await generateCallCopilotText(body.data.action, body.data.transcript.trim(), body.data.locale, memory);
      recordAiUseNonBlocking(context, res.locals.userId, `call_${body.data.action}`, answer.aiPowered);
      return { action: body.data.action, text: answer.text, aiPowered: answer.aiPowered };
    }
    if (body.data.action === "quiz") {
      const made = await createActivity(
        context,
        "quiz",
        body.data.locale === "ar" ? "أنشئ اختباراً قصيراً عن أهم ما ورد في نص المكالمة." : "Create a short quiz from the important details in the call transcript.",
        res.locals.userId,
        body.data.transcript.trim(),
      );
      return {
        action: "quiz",
        text: body.data.locale === "ar" ? "أنشأت اختباراً مشتركاً من نص المكالمة." : "I created a shared quiz from your call.",
        aiPowered: made.aiPowered, activity: made.activity,
      };
    }
    const { summary, aiPowered } = await generateCallSummary(body.data.transcript.trim(), body.data.locale, memory);
    const marker = "SKILLSYNC_CALL_SUMMARY:";
    const content = marker + JSON.stringify(summary);
    const [message] = await db.insert(messages).values({
      id: randomUUID(), roomId: context.room.id, senderId: null, senderName: "SkillSync AI",
      senderType: "assistant", channel: "partner", content,
    }).returning();
    recordAiUseNonBlocking(context, res.locals.userId, "call_summary", aiPowered);
    return {
      action: "summary", text: body.data.locale === "ar" ? "نُشر ملخص المكالمة في المحادثة المشتركة." : "The call summary was posted to Partner Chat.",
      aiPowered, summary, message: messageDto(message),
    };
  }, { userId: res.locals.userId, roomId: context.room.id });
  res.json(RequestSkillSyncCallCopilotResponse.parse(result));
});
router.get("/skillsync/rooms/:roomId/activities", async (req, res) => {
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  res.json(ListSkillSyncActivitiesResponse.parse(await roomActivities(context.room.id)));
});
router.post("/skillsync/rooms/:roomId/activities", async (req, res) => {
  const body = GenerateSkillSyncActivityBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  const result = await withAiBudget(
    () => createActivity(context, body.data.kind, body.data.prompt, res.locals.userId),
    { userId: res.locals.userId, roomId: context.room.id },
  );
  res.status(201).json(GenerateSkillSyncActivityResponse.parse(result.activity));
});
router.post("/skillsync/rooms/:roomId/activities/:activityId/attempts", async (req, res) => {
  const body = SubmitSkillSyncActivityAttemptBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  let speaker;
  try { speaker = resolveSpeaker(context, res.locals.userId, body.data.simulatedUserId); }
  catch (error) { res.status(403).json({ error: (error as Error).message }); return; }
  const [activity] = await db.select().from(activities).where(and(eq(activities.id, String(req.params.activityId)), eq(activities.roomId, context.room.id)));
  if (!activity) { res.status(404).json({ error: "Activity not found." }); return; }
  let score: number | null = null;
  if (activity.kind === "quiz" && activity.content.questions?.length) {
    const questions = activity.content.questions;
    if (body.data.responses.length !== questions.length) { res.status(400).json({ error: "Answer every question." }); return; }
    score = Math.round(100 * questions.filter((q, i) => body.data.responses[i] === String(q.answerIndex)).length / questions.length);
  }
  if (activity.kind === "simulator" && activity.content.simulator) {
    score = body.data.responses[0]?.trim().toLowerCase() === activity.content.simulator.expected.trim().toLowerCase() ? 100 : 0;
  }
  const [attempt] = await db.insert(attempts).values({
    id: randomUUID(), roomId: context.room.id, activityId: activity.id,
    userId: speaker.userId, displayName: speaker.displayName, responses: body.data.responses, score,
  }).returning();
  res.status(201).json(SubmitSkillSyncActivityAttemptResponse.parse(attemptDto(attempt)));
});
export default router;
