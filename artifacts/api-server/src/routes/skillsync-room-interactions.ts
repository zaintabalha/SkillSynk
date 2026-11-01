import { Router, type IRouter, type RequestHandler } from "express";
import {
  SendSkillSyncMessageBody, SendSkillSyncMessageResponse,
  GenerateSkillSyncActivityBody, GenerateSkillSyncActivityResponse,
  SubmitSkillSyncActivityAttemptBody, SubmitSkillSyncActivityAttemptResponse,
  ListSkillSyncActivitiesResponse,
} from "@workspace/api-zod";
import {
  db, skillSyncMessagesTable as messages, skillSyncActivitiesTable as activities,
  skillSyncActivityAttemptsTable as attempts,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { roomContext, resolveSpeaker, roomMemory, messageDto, roomActivities, attemptDto, recordAiUse, type RoomContext } from "../lib/skillsync-room-service";
import { answerRoomQuestion, generateRoomActivity } from "../lib/skillsync-room-ai";

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
async function createActivity(context: RoomContext, kind: Kind, prompt: string, userId: string) {
  const generated = await generateRoomActivity(kind, prompt, await roomMemory(context));
  const id = randomUUID();
  await db.insert(activities).values({
    id, roomId: context.room.id, kind, title: generated.title, instructions: generated.instructions,
    content: generated.content, createdBy: userId, isDemo: !generated.aiPowered,
  });
  await recordAiUse(userId, kind, generated.aiPowered, context.room.isDemo);
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
    const [saved] = await db.insert(messages).values({
      id: randomUUID(), roomId: context.room.id, senderId: speaker.userId, senderName: speaker.displayName,
      senderType: "student", channel, content: body.data.content.trim(), replyToMessageId: quote?.id ?? null,
    }).returning();
    let assistantMessage = null;
    let aiPowered = false;
    // This gate is intentionally before ANY AI work. Ordinary partner messages are only persisted.
    if (channel === "ai" || explicitlyInvokesAi(saved.content, quote?.id)) {
      const kind = quote ? null : requestedActivity(saved.content);
      let content: string;
      let activityId: string | null = null;
      if (kind) {
        const result = await createActivity(context, kind, saved.content, res.locals.userId);
        activityId = result.activity.id;
        aiPowered = result.aiPowered;
        content = /[\u0600-\u06ff]/.test(saved.content)
          ? "أعددت نشاطاً مشتركاً لكما. افتحا تبويب الكويزات والمحاكيات للبدء."
          : "I created a shared activity for you both. Open Quizzes & Simulators to begin.";
      } else {
        const result = await answerRoomQuestion(saved.content, await roomMemory(context), quote?.content);
        content = result.answer;
        aiPowered = result.aiPowered;
        await recordAiUse(res.locals.userId, quote ? "verification" : "shared_chat", aiPowered, context.room.isDemo);
      }
      const [response] = await db.insert(messages).values({
        id: randomUUID(), roomId: context.room.id, senderId: null, senderName: "SkillSync AI",
        senderType: "assistant", channel, content, activityId, replyToMessageId: quote?.id ?? saved.id,
      }).returning();
      assistantMessage = messageDto(response);
    }
    res.status(201).json(SendSkillSyncMessageResponse.parse({ message: messageDto(saved), assistantMessage, aiPowered }));
  };
}
router.post("/skillsync/rooms/:roomId/messages", sendChat("partner"));
router.post("/skillsync/rooms/:roomId/ai-messages", sendChat("ai"));
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
  const result = await createActivity(context, body.data.kind, body.data.prompt, res.locals.userId);
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
