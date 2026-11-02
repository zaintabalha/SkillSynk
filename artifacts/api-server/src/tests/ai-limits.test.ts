import { test } from "node:test";
import assert from "node:assert/strict";
import { AiLimiter, AiLimitError, withAiBudget } from "../lib/skillsync-ai-limits";
import { generateJson, isAiProviderEnabled } from "../lib/skillsync-ai";

test("rolling rate limits expire, rejection is atomic, release is idempotent", () => {
  let now = 0;
  const limiter = new AiLimiter(() => now);
  const user = { key: "user", rate: 2, concurrency: 1 };
  const room = { key: "room", rate: 1, concurrency: 2 };
  const release = limiter.acquire([user, room]);
  assert.throws(() => limiter.acquire([user]), AiLimitError);
  release(); release();
  assert.throws(() => limiter.acquire([user, room]), AiLimitError);
  limiter.acquire([user])(); // rejected room admission did not charge the user
  assert.throws(() => limiter.acquire([user]), (error: unknown) =>
    error instanceof AiLimitError && error.retryAfterSeconds === 60);
  now = 60_000;
  limiter.acquire([user, room])();
});

test("user budgets span rooms; room concurrency spans users; failures release slots", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const a = withAiBudget(() => pending, { userId: "limits-a", roomId: "limits-room" });
  const b = withAiBudget(() => pending, { userId: "limits-b", roomId: "limits-room" });
  await assert.rejects(withAiBudget(async () => {}, { userId: "limits-a", roomId: "other" }), AiLimitError);
  await assert.rejects(withAiBudget(async () => {}, { userId: "limits-c", roomId: "limits-room" }), AiLimitError);
  await withAiBudget(async () => {}, { userId: "limits-c", roomId: "other" });
  finish();
  await Promise.all([a, b]);
  await assert.rejects(withAiBudget(async () => { throw new Error("provider failed"); }, { userId: "limits-a" }), /provider failed/);
  await withAiBudget(async () => {}, { userId: "limits-a" });
});

test("nested shared AI calls charge once and missing identities fail closed", async () => {
  await assert.rejects(generateJson("no identity"), /authenticated request context/);
  assert.equal(typeof isAiProviderEnabled(), "boolean");
  for (let i = 0; i < 10; i++) {
    await withAiBudget(() => withAiBudget(async () => null), { userId: "nested" });
  }
  await assert.rejects(withAiBudget(async () => {}, { userId: "nested" }), AiLimitError);
});


test("room rate budgets span different users", async () => {
  for (let i = 0; i < 20; i++) {
    await withAiBudget(async () => {}, { userId: `room-rate-${i}`, roomId: "room-rate" });
  }
  await assert.rejects(withAiBudget(async () => {}, { userId: "new-user", roomId: "room-rate" }), AiLimitError);
  await withAiBudget(async () => {}, { userId: "new-user", roomId: "new-room" });
});

test("provider attempts have bounded concurrency and rate, with no queue", () => {
  const providerLimiter = new AiLimiter();
  const acquireProvider = () => providerLimiter.acquire([{ key: "provider", rate: 60, concurrency: 4 }]);
  const releases = Array.from({ length: 4 }, () => acquireProvider());
  assert.throws(acquireProvider, AiLimitError);
  releases.forEach((release) => release());
  for (let i = 4; i < 60; i++) acquireProvider()();
  assert.throws(acquireProvider, AiLimitError);
});
