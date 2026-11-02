import express, { Router, type IRouter, type RequestHandler } from "express";
import {
  SendSkillSyncMessageBody, SendSkillSyncMessageResponse,
  GenerateSkillSyncActivityBody, GenerateSkillSyncActivityResponse,
  SubmitSkillSyncActivityAttemptBody, SubmitSkillSyncActivityAttemptResponse,
  ListSkillSyncActivitiesResponse, RequestSkillSyncCallCopilotBody, RequestSkillSyncCallCopilotResponse,
  GenerateSkillSyncSimulatorSolutionParams, GenerateSkillSyncSimulatorSolutionResponse,
  RequestSkillSyncRoomMediaUploadBody, RequestSkillSyncRoomMediaUploadResponse,
  TranscribeSkillSyncVoiceNoteResponse,
} from "@workspace/api-zod";
import {
  db, skillSyncMessagesTable as messages, skillSyncActivitiesTable as activities,
  skillSyncActivityAttemptsTable as attempts,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { roomContext, resolveSpeaker, roomMemory, messageDto, roomActivities, attemptDto, recordAiUse, type RoomContext } from "../lib/skillsync-room-service";
import { answerRoomQuestion, generateCallCopilotText, generateCallSummary, generateRoomActivity, generateSimulatorSolution, transcribeCallAudio } from "../lib/skillsync-room-ai";
import { withAiBudget } from "../lib/skillsync-ai-limits";
import { logger } from "../lib/logger";
import { evaluateSimulatorResponse } from "../lib/skillsync-simulator-evaluation";
import {
  createRoomMediaUploadUrl, deleteRoomMediaFile, getRoomMediaFile, newRoomMediaId,
  readRoomMediaFile, roomMediaObjectPath,
} from "../lib/skillsync-media-storage";

const router: IRouter = Router();
type Kind = "quiz" | "flashcards" | "simulator";
const imageContentTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);
const audioContentTypes = new Set(["audio/mp4", "audio/aac", "audio/m4a", "audio/x-m4a", "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-wav"]);
const MAX_ROOM_MEDIA_BYTES = 25_000_000;

function mediaKind(contentType: string): "image" | "audio" | null {
  if (imageContentTypes.has(contentType)) return "image";
  if (audioContentTypes.has(contentType)) return "audio";
  return null;
}

function safeMediaName(name: string | null | undefined): string | null {
  const normalized = name?.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 255);
  return normalized || null;
}

function replySnapshot(message: typeof messages.$inferSelect) {
  return {
    id: message.id,
    senderName: message.senderType === "student" ? message.senderName : "SkillSync AI",
    contentSnippet: (message.content.trim() || message.transcript?.trim() || "").slice(0, 180),
    mediaType: mediaKind(message.mediaType ?? "") as "image" | "audio" | null,
  };
}

function quoteContext(message: typeof messages.$inferSelect): string {
  const parts = [
    `Original sender: ${message.senderType === "student" ? message.senderName : "SkillSync AI"}`,
    message.content.trim() ? `Message text: ${message.content.trim()}` : "",
    message.transcript?.trim() ? `Voice note transcript: ${message.transcript.trim()}` : "",
    message.mediaType === "image" ? "This message includes an image attachment; its pixels are not available to the text-only tutor." : "",
    message.mediaType === "audio" && !message.transcript?.trim() ? "This message includes a voice note that has not been transcribed yet." : "",
  ].filter(Boolean);
  return parts.join("\n");
}
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
    if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
    const context = await roomContext(String(req.params.roomId), res.locals.userId);
    if (!context) { res.status(404).json({ error: "Room not found." }); return; }
    if (context.room.status === "unmatched") { res.status(409).json({ error: "This pair has been unmatched. The transcript is read-only." }); return; }
    let speaker;
    try { speaker = resolveSpeaker(context, res.locals.userId, body.data.simulatedUserId); }
    catch (error) { res.status(403).json({ error: (error as Error).message }); return; }
    const prompt = body.data.content.trim();
    if (!prompt && !body.data.mediaObjectPath) { res.status(400).json({ error: "Enter a message or attach an image or voice note." }); return; }
    const [quote] = body.data.replyToMessageId
      ? await db.select().from(messages).where(and(eq(messages.id, body.data.replyToMessageId), eq(messages.roomId, context.room.id)))
      : [];
    if (body.data.replyToMessageId && !quote) { res.status(400).json({ error: "Quoted message is not in this room." }); return; }
    const invokesAi = channel === "ai" || explicitlyInvokesAi(prompt, quote?.id);
    let attachedMedia: { id: string; file: NonNullable<Awaited<ReturnType<typeof getRoomMediaFile>>>; type: "image" | "audio"; contentType: string; size: number; name: string | null } | null = null;
    if (body.data.mediaObjectPath) {
      if (context.room.isDemo) { res.status(403).json({ error: "Attachments are disabled in demo rooms. / مشاركة الوسائط معطلة في الغرف التجريبية." }); return; }
      const mediaId = body.data.mediaObjectPath.split("/").at(-1) ?? "";
      let expectedPath = "";
      try { expectedPath = roomMediaObjectPath(context.room.id, mediaId); }
      catch { /* The path will be rejected below. */ }
      if (!mediaId || body.data.mediaObjectPath !== expectedPath) {
        res.status(400).json({ error: "This upload does not belong to the current room." }); return;
      }
      const file = await getRoomMediaFile(context.room.id, mediaId);
      if (!file) { res.status(400).json({ error: "The attachment upload is missing. Upload it again and retry." }); return; }
      const [metadata] = await file.getMetadata();
      const contentType = String(metadata.contentType ?? "").split(";")[0].trim().toLowerCase();
      const type = mediaKind(contentType);
      const size = Number(metadata.size);
      if (!type || !Number.isSafeInteger(size) || size < 1 || size > MAX_ROOM_MEDIA_BYTES) {
        res.status(400).json({ error: "The uploaded attachment is not a supported image or audio file." }); return;
      }
      attachedMedia = {
        id: mediaId, file, type, contentType, size,
        name: safeMediaName(body.data.mediaName),
      };
    }
    const send = async () => {
      let assistantMessage = null;
      let aiPowered = false;
      let content: string | null = null;
      let activityId: string | null = null;
      let transcript: string | null = null;
      // Ordinary partner messages never enter the AI budget or load AI memory.
      if (invokesAi) {
        if (attachedMedia?.type === "audio") {
          const locale = /[\u0600-\u06ff]/u.test(prompt) || req.get("accept-language")?.toLowerCase().startsWith("ar") ? "ar" : "en";
          transcript = await transcribeCallAudio(await readRoomMediaFile(attachedMedia.file), attachedMedia.contentType, locale);
        }
        const aiPrompt = [
          prompt,
          transcript ? `Voice note transcript: ${transcript}` : "",
          attachedMedia?.type === "image" ? "The message includes an image attachment, but its pixels are not available to the text-only tutor. Use only the caption and ask for a description if needed." : "",
        ].filter(Boolean).join("\n\n");
        const kind = quote ? null : requestedActivity(prompt);
        if (kind) {
          const result = await createActivity(context, kind, aiPrompt, res.locals.userId);
          activityId = result.activity.id;
          aiPowered = result.aiPowered;
          content = /[\u0600-\u06ff]/.test(prompt)
            ? "أعددت نشاطاً مشتركاً لكما. افتحا تبويب الكويزات والمحاكيات للبدء."
            : "I created a shared activity for you both. Open Quizzes & Simulators to begin.";
        } else {
          const result = await answerRoomQuestion(aiPrompt, await roomMemory(context), quote ? quoteContext(quote) : undefined);
          content = result.answer;
          aiPowered = result.aiPowered;
          recordAiUseNonBlocking(context, res.locals.userId, quote ? "verification" : "shared_chat", aiPowered);
        }
      }
      // Save only after admission, including provider admission, so 429 retries do not duplicate messages.
      const [saved] = await db.insert(messages).values({
        id: randomUUID(), roomId: context.room.id, senderId: speaker.userId, senderName: speaker.displayName,
        senderType: "student", channel, content: prompt, replyToMessageId: quote?.id ?? null,
        replyTo: quote ? replySnapshot(quote) : null,
        mediaObjectPath: attachedMedia ? body.data.mediaObjectPath : null,
        mediaType: attachedMedia?.type ?? null,
        mediaName: attachedMedia?.name ?? null,
        mediaSize: attachedMedia?.size ?? null,
        mediaDurationSeconds: attachedMedia?.type === "audio" ? body.data.mediaDurationSeconds ?? null : null,
        transcript,
      }).returning();
      if (content !== null) {
        const repliedMessage = quote ?? saved;
        const [response] = await db.insert(messages).values({
          id: randomUUID(), roomId: context.room.id, senderId: null, senderName: "SkillSync AI",
          senderType: "assistant", channel, content, activityId, replyToMessageId: repliedMessage.id,
          replyTo: replySnapshot(repliedMessage),
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
router.post("/skillsync/rooms/:roomId/media/upload-url", async (req, res): Promise<void> => {
  const body = RequestSkillSyncRoomMediaUploadBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  if (context.room.isDemo) { res.status(403).json({ error: "Attachments are disabled in demo rooms. / مشاركة الوسائط معطلة في الغرف التجريبية." }); return; }
  const type = mediaKind(body.data.contentType);
  if (!type || body.data.size > MAX_ROOM_MEDIA_BYTES) {
    res.status(400).json({ error: "Choose a supported attachment under 25 MB." }); return;
  }
  try {
    const mediaId = newRoomMediaId();
    const upload = await createRoomMediaUploadUrl(context.room.id, mediaId);
    res.json(RequestSkillSyncRoomMediaUploadResponse.parse(upload));
  } catch (error) {
    req.log.error({ err: error, roomId: context.room.id }, "Could not create room media upload URL");
    res.status(503).json({ error: "Media storage is temporarily unavailable. Please try again." });
  }
});

router.get("/skillsync/rooms/:roomId/media/:mediaId", async (req, res): Promise<void> => {
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  const mediaId = String(req.params.mediaId);
  let objectPath = "";
  try { objectPath = roomMediaObjectPath(context.room.id, mediaId); }
  catch { res.status(404).json({ error: "Attachment not found." }); return; }
  const [message] = await db.select().from(messages).where(and(
    eq(messages.roomId, context.room.id),
    eq(messages.mediaObjectPath, objectPath),
  ));
  if (!message || (message.mediaType !== "image" && message.mediaType !== "audio")) {
    res.status(404).json({ error: "Attachment not found in this room." }); return;
  }
  const file = await getRoomMediaFile(context.room.id, mediaId);
  if (!file) { res.status(404).json({ error: "Attachment not found." }); return; }
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "application/octet-stream").split(";")[0].trim().toLowerCase();
  const size = Number(metadata.size);
  if (!mediaKind(contentType) || !Number.isSafeInteger(size) || size < 1) {
    res.status(404).json({ error: "Attachment not found." }); return;
  }
  const filename = safeMediaName(message.mediaName) ?? (message.mediaType === "image" ? "shared-image" : "voice-note");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  let start: number | undefined;
  let end: number | undefined;
  const range = req.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
    if (!match || (!match[1] && !match[2])) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return;
    }
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Number(match[2]) : size - 1;
    } else {
      const suffixLength = Number(match[2]);
      start = Math.max(size - suffixLength, 0);
      end = size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`).end(); return;
    }
    end = Math.min(end, size - 1);
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", String(end - start + 1));
  } else {
    res.setHeader("Content-Length", String(size));
  }

  const stream = file.createReadStream(start === undefined ? undefined : { start, end });
  stream.on("error", (error) => {
    req.log.error({ err: error, roomId: context.room.id, mediaId }, "Could not stream room attachment");
    if (res.headersSent) res.destroy(error);
    else res.status(500).json({ error: "Could not load this attachment." });
  });
  stream.pipe(res);
});

router.delete("/skillsync/rooms/:roomId/media/:mediaId", async (req, res): Promise<void> => {
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  if (context.room.isDemo) { res.status(403).json({ error: "Attachments are disabled in demo rooms." }); return; }
  const mediaId = String(req.params.mediaId);
  let objectPath = "";
  try { objectPath = roomMediaObjectPath(context.room.id, mediaId); }
  catch { res.status(404).json({ error: "Pending attachment not found." }); return; }
  const [sentMessage] = await db.select({ id: messages.id }).from(messages).where(and(
    eq(messages.roomId, context.room.id),
    eq(messages.mediaObjectPath, objectPath),
  ));
  if (sentMessage) { res.status(409).json({ error: "This attachment has already been sent." }); return; }
  await deleteRoomMediaFile(context.room.id, mediaId);
  res.sendStatus(204);
});

router.post("/skillsync/rooms/:roomId/messages/:messageId/transcription", async (req, res): Promise<void> => {
  const context = await roomContext(String(req.params.roomId), res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  const [message] = await db.select().from(messages).where(and(
    eq(messages.id, String(req.params.messageId)),
    eq(messages.roomId, context.room.id),
  ));
  if (!message || message.mediaType !== "audio" || !message.mediaObjectPath) {
    res.status(404).json({ error: "Voice note not found in this room." }); return;
  }
  if (message.transcript !== null && message.transcript !== undefined) {
    res.json(TranscribeSkillSyncVoiceNoteResponse.parse({ messageId: message.id, transcript: message.transcript }));
    return;
  }
  const mediaId = message.mediaObjectPath.split("/").at(-1) ?? "";
  const file = await getRoomMediaFile(context.room.id, mediaId);
  if (!file) { res.status(404).json({ error: "Voice note audio is missing." }); return; }
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType ?? "").split(";")[0].trim().toLowerCase();
  const size = Number(metadata.size);
  if (mediaKind(contentType) !== "audio" || !Number.isSafeInteger(size) || size < 1 || size > MAX_ROOM_MEDIA_BYTES) {
    res.status(415).json({ error: "This voice note uses an unsupported audio format." }); return;
  }
  const locale = req.get("accept-language")?.split(",")[0]?.trim().toLowerCase().startsWith("ar") ? "ar" : "en";
  const transcript = await withAiBudget(
    async () => transcribeCallAudio(await readRoomMediaFile(file), contentType, locale),
    { userId: res.locals.userId, roomId: context.room.id },
  );
  const [updated] = await db.update(messages).set({ transcript }).where(eq(messages.id, message.id)).returning();
  recordAiUseNonBlocking(context, res.locals.userId, "voice_note_transcription", true);
  res.json(TranscribeSkillSyncVoiceNoteResponse.parse({ messageId: updated.id, transcript: updated.transcript ?? "" }));
});
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
router.post(
  "/skillsync/rooms/:roomId/call-transcription",
  express.raw({
    type: ["audio/webm", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "application/octet-stream"],
    limit: "8mb",
  }),
  async (req, res): Promise<void> => {
    const context = await roomContext(String(req.params.roomId), res.locals.userId);
    if (!context) { res.status(404).json({ error: "Room not found." }); return; }
    if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }

    const mimeType = req.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    const acceptedTypes = new Set(["audio/webm", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "application/octet-stream"]);
    if (!acceptedTypes.has(mimeType)) {
      res.status(415).json({ error: "Use a supported audio format such as WebM, MP4, Ogg, or WAV." });
      return;
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 1024) {
      res.status(400).json({ error: "The audio chunk is empty or too short. Record a little more and try again." });
      return;
    }

    const rawLocale = req.get("accept-language")?.split(",")[0]?.trim().toLowerCase();
    const locale = rawLocale?.startsWith("ar") ? "ar" : "en";
    const text = await withAiBudget(
      () => transcribeCallAudio(req.body as Buffer, mimeType, locale),
      { userId: res.locals.userId, roomId: context.room.id },
    );
    res.json({ text });
  },
);
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
router.post("/skillsync/rooms/:roomId/activities/:activityId/solution", async (req, res): Promise<void> => {
  const params = GenerateSkillSyncSimulatorSolutionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const context = await roomContext(params.data.roomId, res.locals.userId);
  if (!context) { res.status(404).json({ error: "Room not found." }); return; }
  if (context.room.status === "unmatched") { res.status(409).json({ error: "This room is read-only." }); return; }
  const [activity] = await db.select().from(activities).where(and(
    eq(activities.id, params.data.activityId),
    eq(activities.roomId, context.room.id),
  ));
  if (!activity) { res.status(404).json({ error: "Activity not found." }); return; }
  if (activity.kind !== "simulator" || !activity.content.simulator || activity.content.simulator.mode !== "coding") {
    res.status(400).json({ error: "AI solutions are available only for coding simulators." });
    return;
  }
  const code = await withAiBudget(
    () => generateSimulatorSolution(activity.content.simulator!),
    { userId: res.locals.userId, roomId: context.room.id },
  );
  recordAiUseNonBlocking(context, res.locals.userId, "simulator_solution", true);
  res.json(GenerateSkillSyncSimulatorSolutionResponse.parse({ code }));
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
    score = evaluateSimulatorResponse(
      activity.content.simulator.mode,
      body.data.responses[0] ?? "",
      activity.content.simulator.expected,
      activity.content.simulator.prompt,
    );
  }
  const [attempt] = await db.insert(attempts).values({
    id: randomUUID(), roomId: context.room.id, activityId: activity.id,
    userId: speaker.userId, displayName: speaker.displayName, responses: body.data.responses, score,
  }).returning();
  res.status(201).json(SubmitSkillSyncActivityAttemptResponse.parse(attemptDto(attempt)));
});
export default router;
