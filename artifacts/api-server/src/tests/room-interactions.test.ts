import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import {
  db, pool, skillSyncProfilesTable as profiles, skillSyncMatchesTable as matches,
  skillSyncRoomsTable as rooms, skillSyncMessagesTable as messages, skillSyncActivitiesTable as activities,
  skillSyncActivityAttemptsTable as attempts, skillSyncAiUsageTable as usage,
} from "@workspace/db";
import interactionRouter, { explicitlyInvokesAi, requestedActivity } from "../routes/skillsync-room-interactions";
import { isAiProviderEnabled } from "../lib/skillsync-ai";
import type { ChatSendResult, SharedActivity, ActivityAttempt, CallCopilotResult } from "@workspace/api-zod";
import "./ai-limits.test";
import { aiLimitErrorHandler, aiRequestContext, withAiBudget } from "../lib/skillsync-ai-limits";

test("partner chat, shared activities, and simulation permission boundaries", async () => {
  assert.equal(explicitlyInvokesAi("A normal conversation about AI"), false);
  assert.equal(explicitlyInvokesAi("contact someone@AI.example"), false);
  assert.equal(explicitlyInvokesAi("@AI give us a quiz"), true);
  assert.equal(explicitlyInvokesAi("@SkillSync، تحقق"), true);
  assert.equal(explicitlyInvokesAi("Is this correct?", "message-id"), true);
  assert.equal(requestedActivity("How should we represent a flashcard front and back in a JavaScript array?"), null);
  assert.equal(requestedActivity("Explain the answer to the quiz"), null);
  assert.equal(requestedActivity("@AI give us a quiz"), "quiz");
  assert.equal(requestedActivity("@SkillSync أنشئ بطاقات للمراجعة"), "flashcards");
  const id = `test-${randomUUID()}`;
  const ids = [`${id}-a`, `${id}-b`];
  let actingUser = ids[0];
  const app = express();
  app.use(express.json());
  // Test-only authentication fixture; this harness is not imported by the running app.
  app.use((_req, res, next) => { res.locals.userId = actingUser; next(); });
  app.use(aiRequestContext);
  app.use(interactionRouter);
  app.use(aiLimitErrorHandler);
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address() as { port: number };
  const request = async <T = ChatSendResult>(path: string, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/skillsync/rooms/${id}${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, body: await response.json() as T };
  };
  const requestAudio = async (audio: Buffer) => {
    const response = await fetch(`http://127.0.0.1:${address.port}/skillsync/rooms/${id}/call-transcription`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav", "Accept-Language": "en" },
      body: audio as unknown as string,
    });
    return { status: response.status, body: await response.json() as { text?: string; error?: string } };
  };
  const requestAs = async <T>(userId: string, path: string, body: unknown) => {
    const previousUser = actingUser;
    actingUser = userId;
    try { return await request<T>(path, body); }
    finally { actingUser = previousUser; }
  };
  try {
    await db.insert(profiles).values(ids.map((userId, i) => ({ userId, displayName: `Test ${i}`, university: "Test university", teachSkill: "Testing", learnSkill: "Design", bio: "" })));
    await db.insert(matches).values({ id, userAId: ids[0], userBId: ids[1], rationale: "Test fixture" });
    await db.insert(rooms).values({ id, matchId: id, projectTitle: "Test project", curriculum: { title: "Test project", description: "Test", goal: "Practice", stages: ["Plan", "Build"] } });
    const ordinary = await request("/messages", { content: "Let's compare our first examples." });
    assert.equal(ordinary.status, 201);
    assert.equal(ordinary.body.assistantMessage, null);
    assert.equal(ordinary.body.message.channel, "partner");
    assert.equal((await request("/messages", { content: "   " })).status, 400);
    assert.equal((await db.select().from(messages).where(eq(messages.roomId, id))).length, 1);
    assert.equal((await request("/messages", { content: "Attempted impersonation", simulatedUserId: ids[1] })).status, 403);
    assert.equal((await request("/messages", { content: "Verify", replyToMessageId: "not-in-this-room" })).status, 400);
    actingUser = `${id}-outsider`;
    assert.equal((await request("/activities")).status, 404);
    await db.update(rooms).set({ isDemo: true }).where(eq(rooms.id, id));
    const simulated = await request("/messages", { content: "A demo partner message", simulatedUserId: ids[1] });
    assert.equal(simulated.status, 201);
    assert.equal(simulated.body.message.senderId, ids[1]);
    assert.equal(simulated.body.assistantMessage, null);
    assert.equal((await request("/messages", { content: "Invalid sender", simulatedUserId: "unrelated-student" })).status, 403);
    const reply = await request("/messages", { content: "Here is my reply.", replyToMessageId: simulated.body.message.id, simulatedUserId: ids[0] });
    assert.equal(reply.status, 201);
    assert.deepEqual(reply.body.message.replyTo, {
      id: simulated.body.message.id,
      senderName: simulated.body.message.senderName,
      contentSnippet: "A demo partner message",
      mediaType: null,
    });
    const storedReply = (await db.select().from(messages).where(eq(messages.id, reply.body.message.id)))[0];
    assert.equal(storedReply.replyTo?.id, simulated.body.message.id);
    assert.equal((await request("/media/upload-url", { fileName: "photo.jpg", size: 5000, contentType: "image/jpeg" })).status, 403);
    assert.equal((await request("/messages", { content: "caption", mediaObjectPath: `/objects/uploads/skillsync/${id}/${randomUUID()}` })).status, 403);
    assert.equal((await request(`/media/${randomUUID()}`)).status, 404);
    // Occupy the authenticated user's slot, not the simulated student's slot.
    await withAiBudget(async () => {
      const before = (await db.select().from(messages).where(eq(messages.roomId, id))).length;
      for (const [path, body] of [
        ["/messages", { content: "@AI explain", simulatedUserId: ids[0] }],
        ["/messages", { content: "@SkillSync اشرح", simulatedUserId: ids[1] }],
        ["/messages", { content: "Verify", replyToMessageId: simulated.body.message.id }],
        ["/ai-messages", { content: "Explain" }],
        ["/activities", { kind: "quiz", prompt: "Practice" }],
      ] as const) {
        const blocked = await request<{ error: string; code: string; retryAfterSeconds: number }>(path, body);
        assert.equal(blocked.status, 429);
        assert.equal(blocked.body.code, "AI_LIMIT_EXCEEDED");
        assert.match(blocked.body.error, /Try again/);
        assert.match(blocked.body.error, /حاول مجدداً/);
        assert.equal(blocked.headers.get("retry-after"), String(blocked.body.retryAfterSeconds));
      }
      assert.equal((await db.select().from(messages).where(eq(messages.roomId, id))).length, before);
      assert.equal((await request("/messages", { content: "We can still talk about a quiz." })).status, 201);
    }, { userId: actingUser, roomId: id });
    if (!isAiProviderEnabled()) {
      const quiz = await request("/messages", { content: "@AI give us a quiz", simulatedUserId: ids[0] });
      assert.equal(quiz.status, 201);
      assert.ok(quiz.body.assistantMessage);
      assert.ok(quiz.body.assistantMessage.activityId);
      assert.equal(quiz.body.assistantMessage.senderName, "SkillSync AI");
      const activityList = await request<SharedActivity[]>("/activities");
      const activity = activityList.body.find((item) => item.id === quiz.body.assistantMessage?.activityId)!;
      const answers = activity.content.questions!.map((q) => String(q.answerIndex));
      const attempt = await request<ActivityAttempt>(`/activities/${activity.id}/attempts`, { responses: answers, simulatedUserId: ids[1] });
      assert.equal(attempt.status, 201);
      assert.equal(attempt.body.userId, ids[1]);
      assert.equal(attempt.body.score, 100);
      const ai = await request("/ai-messages", { content: "Explain the next stage.", simulatedUserId: ids[0] });
      assert.equal(ai.status, 201);
      assert.equal(ai.body.assistantMessage?.channel, "ai");
      const verify = await request("/messages", { content: "Is this message correct?", replyToMessageId: simulated.body.message.id });
      assert.equal(verify.status, 201);
      assert.equal(verify.body.assistantMessage?.replyToMessageId, simulated.body.message.id);
      assert.match(verify.body.assistantMessage?.content ?? "", /not been verified/);
    }
    if (isAiProviderEnabled()) {
      const sampleRate = 16_000;
      const dataSize = sampleRate * 2 * 4;
      const silentWav = Buffer.alloc(44 + dataSize);
      silentWav.write("RIFF", 0);
      silentWav.writeUInt32LE(36 + dataSize, 4);
      silentWav.write("WAVE", 8);
      silentWav.write("fmt ", 12);
      silentWav.writeUInt32LE(16, 16);
      silentWav.writeUInt16LE(1, 20);
      silentWav.writeUInt16LE(1, 22);
      silentWav.writeUInt32LE(sampleRate, 24);
      silentWav.writeUInt32LE(sampleRate * 2, 28);
      silentWav.writeUInt16LE(2, 32);
      silentWav.writeUInt16LE(16, 34);
      silentWav.write("data", 36);
      silentWav.writeUInt32LE(dataSize, 40);
      const previousActingUser = actingUser;
      actingUser = ids[0];
      const transcription = await requestAudio(silentWav);
      actingUser = previousActingUser;
      assert.equal(transcription.status, 200, JSON.stringify(transcription.body));
      assert.equal(typeof transcription.body.text, "string");
    }
    const speakingPrompt = await requestAs<CallCopilotResult>(`${id}-copilot-speaking`, "/call-copilot", { action: "speaking_prompt", transcript: "", locale: "en" });
    assert.equal(speakingPrompt.status, 200, JSON.stringify(speakingPrompt.body));
    assert.equal(speakingPrompt.body.action, "speaking_prompt");
    const liveHint = await requestAs<CallCopilotResult>(`${id}-copilot-hint`, "/call-copilot", { action: "hint", transcript: "We discussed an array of flashcards.", locale: "en" });
    assert.equal(liveHint.status, 200, JSON.stringify(liveHint.body));
    const callQuiz = await requestAs<CallCopilotResult>(`${id}-copilot-quiz`, "/call-copilot", { action: "quiz", transcript: "A JavaScript array stores related flashcard objects.", locale: "en" });
    assert.equal(callQuiz.status, 200, JSON.stringify(callQuiz.body));
    assert.equal(callQuiz.body.activity?.kind, "quiz");
    const callSummary = await requestAs<CallCopilotResult>(`${id}-copilot-summary`, "/call-copilot", { action: "summary", transcript: "We learned that arrays store a sequence of values.", locale: "en" });
    assert.equal(callSummary.status, 200, JSON.stringify(callSummary.body));
    assert.ok(callSummary.body.summary);
    assert.ok((await db.select().from(messages).where(eq(messages.roomId, id))).some((message) => message.content.startsWith("SKILLSYNC_CALL_SUMMARY:")));
    await db.update(rooms).set({ status: "unmatched" }).where(eq(rooms.id, id));
    assert.equal((await request("/messages", { content: "Read-only check" })).status, 409);
    assert.equal((await request("/call-copilot", { action: "hint", transcript: "Text", locale: "en" })).status, 409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.delete(attempts).where(eq(attempts.roomId, id));
    await db.delete(activities).where(eq(activities.roomId, id));
    await db.delete(messages).where(eq(messages.roomId, id));
    await db.delete(usage).where(inArray(usage.userId, [...ids, `${id}-outsider`]));
    await db.delete(rooms).where(eq(rooms.id, id));
    await db.delete(matches).where(eq(matches.id, id));
    await db.delete(profiles).where(inArray(profiles.userId, ids));
    await pool.end();
  }
});
