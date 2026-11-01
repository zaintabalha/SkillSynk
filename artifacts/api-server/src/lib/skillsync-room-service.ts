import {
  db, skillSyncRoomsTable as rooms, skillSyncMatchesTable as matches,
  skillSyncProfilesTable as profiles, skillSyncMessagesTable as messages,
  skillSyncActivitiesTable as activities, skillSyncActivityAttemptsTable as attempts,
  skillSyncAiUsageTable as usage,
} from "@workspace/db";
import { eq, inArray, asc } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ensureDemoData } from "./skillsync-demo";

export async function roomContext(roomId: string, userId: string) {
  await ensureDemoData();
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
  if (!room) return null;
  const [match] = await db.select().from(matches).where(eq(matches.id, room.matchId));
  if (!match || (!room.isDemo && ![match.userAId, match.userBId].includes(userId))) return null;
  const students = await db.select().from(profiles).where(inArray(profiles.userId, [match.userAId, match.userBId]));
  return { room, match, students };
}
export type RoomContext = NonNullable<Awaited<ReturnType<typeof roomContext>>>;
export function resolveSpeaker(context: RoomContext, userId: string, simulatedUserId?: string | null) {
  if (simulatedUserId && (!context.room.isDemo || !context.students.some((p) => p.userId === simulatedUserId))) {
    throw new Error("Partner simulation is only allowed for the two sample students in a demo room.");
  }
  const speakerId = simulatedUserId || (context.room.isDemo ? context.match.userAId : userId);
  return { userId: speakerId, displayName: context.students.find((p) => p.userId === speakerId)?.displayName ?? "Student" };
}
export function messageDto(message: typeof messages.$inferSelect) {
  const assistant = message.senderType !== "student";
  return {
    id: message.id, roomId: message.roomId, senderId: message.senderId,
    senderName: assistant ? "SkillSync AI" : message.senderName,
    senderType: assistant ? "assistant" as const : "student" as const,
    channel: message.channel === "ai" || message.senderType === "moderator" ? "ai" as const : "partner" as const,
    replyToMessageId: message.replyToMessageId, activityId: message.activityId,
    content: message.content, createdAt: message.createdAt.toISOString(),
  };
}
export async function roomMemory(context: RoomContext) {
  const conversation = await db.select().from(messages).where(eq(messages.roomId, context.room.id)).orderBy(asc(messages.createdAt));
  return {
    students: context.students.map(({ userId, displayName, university, teachSkill, learnSkill, bio }) => ({
      userId, displayName, university, teachSkill, learnSkill, bio,
    })),
    curriculum: context.room.curriculum,
    conversation: conversation.map(messageDto),
  };
}
export function attemptDto(attempt: typeof attempts.$inferSelect) {
  return { id: attempt.id, activityId: attempt.activityId, userId: attempt.userId, displayName: attempt.displayName, responses: attempt.responses, score: attempt.score, createdAt: attempt.createdAt.toISOString() };
}
export async function roomActivities(roomId: string) {
  const [items, responses] = await Promise.all([
    db.select().from(activities).where(eq(activities.roomId, roomId)).orderBy(asc(activities.createdAt)),
    db.select().from(attempts).where(eq(attempts.roomId, roomId)).orderBy(asc(attempts.createdAt)),
  ]);
  return items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), attempts: responses.filter((a) => a.activityId === item.id).map(attemptDto) }));
}
export async function recordAiUse(userId: string, feature: string, aiPowered: boolean, isDemo = false) {
  await db.insert(usage).values({ id: randomUUID(), userId, feature, aiPowered, isDemo });
}
