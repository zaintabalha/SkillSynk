import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, desc } from "drizzle-orm";
import {
  db, skillSyncProfilesTable as profiles, skillSyncRoomsTable as rooms,
  skillSyncMatchesTable as matches, skillSyncMessagesTable as messages,
  skillSyncReportsTable as reports, skillSyncAdminActionsTable as actions,
  skillSyncSuspensionsTable as suspensions, skillSyncUserNoticesTable as notices,
  skillSyncAiUsageTable as usage, skillSyncSubmissionsTable as submissions,
} from "@workspace/db";
import {
  SubmitSkillSyncReportBody, SubmitSkillSyncReportResponse,
  UpdateSkillSyncAdminReportBody, WarnSkillSyncAdminUserBody, SuspendSkillSyncAdminUserBody,
  GetSkillSyncAdminOverviewResponse, ListSkillSyncAdminReportsResponse, GetSkillSyncAdminReportResponse,
  ListSkillSyncAdminUsersResponse, ListSkillSyncAdminRoomsResponse,
} from "@workspace/api-zod";
import { adminIds, isAdmin, requireSkillSyncAdmin } from "../lib/skillsync-access";
import { ensureDemoData } from "../lib/skillsync-demo";
import { messageDto, roomContext, roomMemory, recordAiUse } from "../lib/skillsync-room-service";
import { generateCurriculum } from "../lib/skillsync-ai";

const router: IRouter = Router();
const iso = (date: Date) => date.toISOString();
async function reportDtos(rows: Array<typeof reports.$inferSelect>) {
  const ids = [...new Set(rows.flatMap((r) => [r.reporterUserId, ...(r.reportedUserId ? [r.reportedUserId] : [])]))];
  const roomIds = rows.flatMap((r) => r.roomId ? [r.roomId] : []);
  const people: Array<typeof profiles.$inferSelect> = ids.length ? await db.select().from(profiles).where(inArray(profiles.userId, ids)) : [];
  const roomRows: Array<typeof rooms.$inferSelect> = roomIds.length ? await db.select().from(rooms).where(inArray(rooms.id, roomIds)) : [];
  return rows.map((r) => ({
    ...r, reporterName: people.find((p) => p.userId === r.reporterUserId)?.displayName ?? "Student",
    reportedName: people.find((p) => p.userId === r.reportedUserId)?.displayName ?? null,
    roomTitle: roomRows.find((room) => room.id === r.roomId)?.projectTitle ?? null,
    createdAt: iso(r.createdAt), updatedAt: iso(r.updatedAt),
  }));
}
async function audit(adminUserId: string, action: string, description: string, targetUserId: string | null = null, roomId: string | null = null) {
  const [row] = await db.insert(actions).values({ id: randomUUID(), adminUserId, action, description, targetUserId, roomId }).returning();
  return { ...row, createdAt: iso(row.createdAt) };
}
router.post("/skillsync/reports", async (req, res) => {
  const body = SubmitSkillSyncReportBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const userId = res.locals.userId as string;
  if (body.data.roomId) {
    const context = await roomContext(body.data.roomId, userId);
    if (!context || (body.data.reportedUserId && ![context.match.userAId, context.match.userBId].includes(body.data.reportedUserId))) {
      res.status(403).json({ error: "You can only report a room you belong to and its participants." }); return;
    }
  } else if (body.data.reportedUserId) {
    const [person] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, body.data.reportedUserId));
    if (!person) { res.status(404).json({ error: "Student not found." }); return; }
  }
  const [report] = await db.insert(reports).values({ id: randomUUID(), reporterUserId: userId, ...body.data }).returning();
  res.status(201).json(SubmitSkillSyncReportResponse.parse((await reportDtos([report]))[0]));
});
router.get("/skillsync/notices", async (_req, res) => {
  const rows = await db.select().from(notices).where(and(eq(notices.userId, res.locals.userId), isNull(notices.readAt))).orderBy(desc(notices.createdAt));
  res.json(rows.map((n) => ({ id: n.id, kind: n.kind, message: n.message, createdAt: iso(n.createdAt) })));
});
router.post("/skillsync/notices/:noticeId/read", async (req, res) => {
  const rows = await db.update(notices).set({ readAt: new Date() }).where(and(eq(notices.id, String(req.params.noticeId)), eq(notices.userId, res.locals.userId))).returning({ id: notices.id });
  if (!rows.length) { res.status(404).json({ error: "Notice not found." }); return; }
  res.sendStatus(204);
});
router.get("/skillsync/admin/access", (_req, res) => res.json({ isAdmin: isAdmin(res.locals.userId), configured: adminIds().length > 0 }));
router.use("/skillsync/admin", requireSkillSyncAdmin, async (_req, _res, next) => { await ensureDemoData(); next(); });
router.get("/skillsync/admin/overview", async (_req, res) => {
  const [people, roomRows, projectRows, reportRows, events, pairRows] = await Promise.all([
    db.select().from(profiles), db.select().from(rooms), db.select({ id: submissions.id }).from(submissions),
    db.select({ status: reports.status, isDemo: reports.isDemo }).from(reports),
    db.select({ aiPowered: usage.aiPowered }).from(usage), db.select({ id: matches.id }).from(matches),
  ]);
  const skillCounts = new Map<string, number>();
  people.forEach((p) => skillCounts.set(p.teachSkill, (skillCounts.get(p.teachSkill) ?? 0) + 1));
  res.json(GetSkillSyncAdminOverviewResponse.parse({
    stats: {
      totalStudents: people.length, demoStudents: people.filter((p) => p.isDemo).length,
      activeRooms: roomRows.filter((r) => r.status === "active").length, completedProjects: projectRows.length,
      openComplaints: reportRows.filter((r) => r.status !== "resolved").length,
      connectionsMade: pairRows.length, matchAttempts: pairRows.length,
      matchSuccessRate: pairRows.length ? Math.round(roomRows.filter((r) => r.status === "completed").length / pairRows.length * 100) : 0,
      aiActions: events.length, geminiCalls: events.filter((e) => e.aiPowered).length, fallbackCalls: events.filter((e) => !e.aiPowered).length,
    },
    skillDistribution: [...skillCounts].map(([skill, count]) => ({ skill, count })),
    reportStatuses: ["pending", "under_review", "resolved"].map((status) => ({ status, count: reportRows.filter((r) => r.status === status).length })),
    sampleDataIncluded: people.some((p) => p.isDemo),
  }));
});
router.get("/skillsync/admin/reports", async (req, res) => {
  const status = req.query.status;
  if (status && !["pending", "under_review", "resolved"].includes(String(status))) { res.status(400).json({ error: "Invalid status." }); return; }
  const rows = await db.select().from(reports).where(status ? eq(reports.status, String(status)) : undefined).orderBy(desc(reports.createdAt));
  res.json(ListSkillSyncAdminReportsResponse.parse(await reportDtos(rows)));
});
router.get("/skillsync/admin/reports/:reportId", async (req, res) => {
  const [report] = await db.select().from(reports).where(eq(reports.id, String(req.params.reportId)));
  if (!report) { res.status(404).json({ error: "Report not found." }); return; }
  const transcript = report.roomId ? await db.select().from(messages).where(eq(messages.roomId, report.roomId)).orderBy(messages.createdAt) : [];
  res.json(GetSkillSyncAdminReportResponse.parse({ report: (await reportDtos([report]))[0], transcript: transcript.map(messageDto) }));
});
router.patch("/skillsync/admin/reports/:reportId", async (req, res) => {
  const body = UpdateSkillSyncAdminReportBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [report] = await db.update(reports).set({ ...body.data, updatedAt: new Date() }).where(eq(reports.id, String(req.params.reportId))).returning();
  if (!report) { res.status(404).json({ error: "Report not found." }); return; }
  await audit(res.locals.userId, "report_review", `${report.id}: ${body.data.status}`);
  res.json((await reportDtos([report]))[0]);
});
router.get("/skillsync/admin/users", async (_req, res) => {
  const [people, pairs, restrictions, warnings] = await Promise.all([
    db.select().from(profiles), db.select().from(matches), db.select().from(suspensions),
    db.select({ targetUserId: actions.targetUserId }).from(actions).where(eq(actions.action, "warning")),
  ]);
  res.json(ListSkillSyncAdminUsersResponse.parse(people.map((p) => {
    const suspension = restrictions.find((s) => s.userId === p.userId && (!s.endsAt || s.endsAt > new Date()));
    return { ...p, isSuspended: Boolean(suspension), suspensionEndsAt: suspension?.endsAt?.toISOString() ?? null,
      roomCount: pairs.filter((m) => [m.userAId, m.userBId].includes(p.userId)).length,
      warningCount: warnings.filter((w) => w.targetUserId === p.userId).length, createdAt: iso(p.createdAt) };
  })));
});
router.get("/skillsync/admin/rooms", async (_req, res) => {
  const [roomRows, pairs, people] = await Promise.all([db.select().from(rooms), db.select().from(matches), db.select().from(profiles)]);
  res.json(ListSkillSyncAdminRoomsResponse.parse(roomRows.map((r) => {
    const pair = pairs.find((m) => m.id === r.matchId);
    return { roomId: r.id, matchId: r.matchId, partnerNames: people.filter((p) => pair && [pair.userAId, pair.userBId].includes(p.userId)).map((p) => p.displayName),
      projectTitle: r.projectTitle, status: r.status, progress: r.progress, isDemo: r.isDemo, updatedAt: iso(r.updatedAt) };
  })));
});
router.post("/skillsync/admin/users/:userId/warning", async (req, res) => {
  const body = WarnSkillSyncAdminUserBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const target = String(req.params.userId);
  const [person] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, target));
  if (!person) { res.status(404).json({ error: "Student not found." }); return; }
  await db.insert(notices).values({ id: randomUUID(), userId: target, message: body.data.message });
  res.status(201).json(await audit(res.locals.userId, "warning", body.data.message, target));
});
router.put("/skillsync/admin/users/:userId/suspension", async (req, res) => {
  const body = SuspendSkillSyncAdminUserBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const target = String(req.params.userId);
  if (isAdmin(target)) { res.status(400).json({ error: "Administrators cannot be suspended here." }); return; }
  const [person] = await db.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, target));
  if (!person) { res.status(404).json({ error: "Student not found." }); return; }
  const values = { userId: target, reason: body.data.reason, createdBy: res.locals.userId as string, startsAt: new Date(),
    endsAt: body.data.durationDays === null ? null : new Date(Date.now() + body.data.durationDays * 86400000) };
  await db.insert(suspensions).values(values).onConflictDoUpdate({ target: suspensions.userId, set: values });
  res.json(await audit(res.locals.userId, "suspend", body.data.reason, target));
});
router.delete("/skillsync/admin/users/:userId/suspension", async (req, res) => {
  await db.delete(suspensions).where(eq(suspensions.userId, String(req.params.userId)));
  await audit(res.locals.userId, "restore", "Account access restored.", String(req.params.userId));
  res.sendStatus(204);
});
router.post("/skillsync/admin/rooms/:roomId/unmatch", async (req, res) => {
  const [room] = await db.update(rooms).set({ status: "unmatched", updatedAt: new Date() }).where(eq(rooms.id, String(req.params.roomId))).returning();
  if (!room) { res.status(404).json({ error: "Room not found." }); return; }
  res.json(await audit(res.locals.userId, "unmatch", "Pair unmatched; transcript preserved.", null, room.id));
});
router.post("/skillsync/admin/rooms/:roomId/regenerate-curriculum", async (req, res) => {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, String(req.params.roomId)));
  if (!room) { res.status(404).json({ error: "Room not found." }); return; }
  const [pair] = await db.select().from(matches).where(eq(matches.id, room.matchId));
  if (!pair) { res.status(404).json({ error: "Pair not found." }); return; }
  const students = await db.select().from(profiles).where(inArray(profiles.userId, [pair.userAId, pair.userBId]));
  if (students.length !== 2) { res.status(409).json({ error: "Both profiles are required." }); return; }
  const context = await roomContext(room.id, pair.userAId);
  const curriculum = await generateCurriculum(students[0], students[1], context ? await roomMemory(context) : undefined);
  await db.update(rooms).set({ curriculum, projectTitle: curriculum.title, updatedAt: new Date() }).where(eq(rooms.id, room.id));
  await recordAiUse(res.locals.userId, "curriculum", curriculum.aiPowered, room.isDemo);
  await audit(res.locals.userId, "curriculum", "Learning plan regenerated.", null, room.id);
  res.json({ roomId: room.id, curriculum, aiPowered: curriculum.aiPowered });
});
export default router;
