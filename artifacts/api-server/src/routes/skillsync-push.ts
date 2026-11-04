import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  RegisterSkillSyncPushDeviceBody,
  UnregisterSkillSyncPushDeviceBody,
} from "@workspace/api-zod";
import { db, skillSyncPushDevicesTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/skillsync/push/devices", async (req, res): Promise<void> => {
  const parsed = RegisterSkillSyncPushDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid iOS push device registration");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = res.locals.userId as string;
  await db.insert(skillSyncPushDevicesTable).values({
    token: parsed.data.token.toLowerCase(),
    userId,
    environment: parsed.data.environment,
  }).onConflictDoUpdate({
    target: skillSyncPushDevicesTable.token,
    set: { userId, environment: parsed.data.environment, updatedAt: new Date() },
  });
  res.sendStatus(204);
});

router.delete("/skillsync/push/devices", async (req, res): Promise<void> => {
  const parsed = UnregisterSkillSyncPushDeviceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db.delete(skillSyncPushDevicesTable).where(and(
    eq(skillSyncPushDevicesTable.token, parsed.data.token.toLowerCase()),
    eq(skillSyncPushDevicesTable.userId, res.locals.userId as string),
  ));
  res.sendStatus(204);
});

export default router;
