import { AsyncLocalStorage } from "node:async_hooks";
import type { ErrorRequestHandler, RequestHandler } from "express";

type Identity = { userId: string; roomId?: string; reserved?: boolean };
type Bucket = { starts: number[]; active: number };
type Rule = { key: string; rate: number; concurrency: number };

export class AiLimitError extends Error {
  readonly code = "AI_LIMIT_EXCEEDED";
  constructor(readonly retryAfterSeconds: number) {
    super(`AI is busy or its request limit was reached. Try again in ${retryAfterSeconds} seconds. Partner chat is still available. / الذكاء الاصطناعي مشغول أو تم بلوغ حد الطلبات. حاول مجدداً بعد ${retryAfterSeconds} ثانية. تظل محادثة الشريك متاحة.`);
  }
}

// Process-local rolling windows. No waiting queue; idle entries expire on admission.
export class AiLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(private readonly now = Date.now, private readonly windowMs = 60_000) {}

  acquire(rules: Rule[]): () => void {
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      bucket.starts = bucket.starts.filter((start) => start > now - this.windowMs);
      if (!bucket.active && !bucket.starts.length) this.buckets.delete(key);
    }
    let retry = 0;
    for (const rule of rules) {
      const bucket = this.buckets.get(rule.key);
      if (!bucket) continue;
      if (bucket.active >= rule.concurrency) retry = Math.max(retry, 5);
      if (bucket.starts.length >= rule.rate) {
        retry = Math.max(retry, Math.ceil((bucket.starts[0] + this.windowMs - now) / 1000));
      }
    }
    // Check every dimension before charging any of them.
    if (retry) throw new AiLimitError(retry);
    const acquired = rules.map(({ key }) => {
      const bucket = this.buckets.get(key) ?? { starts: [], active: 0 };
      bucket.starts.push(now);
      bucket.active++;
      this.buckets.set(key, bucket);
      return bucket;
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const bucket of acquired) bucket.active--;
    };
  }
}

const context = new AsyncLocalStorage<Identity>();
const requests = new AiLimiter();
const provider = new AiLimiter();

export const aiRequestContext: RequestHandler = (req, res, next) => {
  const encodedRoomId = /\/rooms\/([^/]+)/.exec(req.path)?.[1];
  let roomId: string | undefined;
  try { roomId = encodedRoomId ? decodeURIComponent(encodedRoomId) : undefined; }
  catch (error) { next(error); return; }
  context.run({ userId: res.locals.userId, roomId }, next);
};

export async function withAiBudget<T>(work: () => Promise<T>, identity = context.getStore()): Promise<T> {
  if (identity?.reserved) return work();
  if (!identity?.userId) throw new Error("AI generation requires an authenticated request context");
  const rules: Rule[] = [
    { key: `user:${identity.userId}`, rate: 10, concurrency: 1 },
    { key: "server", rate: 120, concurrency: 8 },
  ];
  if (identity.roomId) rules.push({ key: `room:${identity.roomId}`, rate: 20, concurrency: 2 });
  const release = requests.acquire(rules);
  try {
    return await context.run({ ...identity, reserved: true }, work);
  } finally {
    release();
  }
}

// Each provider attempt (including retries) counts, independently of logical requests.
export function acquireProviderSlot(): () => void {
  return provider.acquire([{ key: "provider", rate: 60, concurrency: 4 }]);
}

export const aiLimitErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (!(error instanceof AiLimitError)) { next(error); return; }
  res.setHeader("Retry-After", String(error.retryAfterSeconds));
  res.status(429).json({ error: error.message, code: error.code, retryAfterSeconds: error.retryAfterSeconds });
};
