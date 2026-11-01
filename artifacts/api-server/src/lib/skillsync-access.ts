import { getAuth } from "@clerk/express";
import { db, skillSyncSuspensionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";

export function adminIds() {
  return (process.env.SKILLSYNC_ADMIN_USER_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
}
export function isAdmin(userId: string) { return adminIds().includes(userId); }
export const requireSkillSyncAuth: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in to use SkillSync." }); return; }
  res.locals.userId = userId;
  if (!isAdmin(userId)) {
    const [suspension] = await db.select().from(skillSyncSuspensionsTable).where(eq(skillSyncSuspensionsTable.userId, userId));
    if (suspension && (!suspension.endsAt || suspension.endsAt > new Date())) {
      res.status(403).json({ error: `Account suspended: ${suspension.reason}` }); return;
    }
  }
  next();
};
export const requireSkillSyncAdmin: RequestHandler = (_req, res, next) => {
  if (!isAdmin(res.locals.userId)) { res.status(403).json({ error: "Administrator access is required." }); return; }
  next();
};
