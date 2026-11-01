import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncActivityAttemptsTable = pgTable("skillsync_activity_attempts", {
  id: text("id").primaryKey(),
  activityId: text("activity_id").notNull(),
  roomId: text("room_id").notNull(),
  userId: text("user_id").notNull(),
  displayName: text("display_name").notNull(),
  responses: jsonb("responses").$type<string[]>().notNull(),
  score: integer("score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncActivityAttemptSchema = createInsertSchema(skillSyncActivityAttemptsTable).omit({
  createdAt: true,
});
export type InsertSkillSyncActivityAttempt = z.infer<typeof insertSkillSyncActivityAttemptSchema>;
export type SkillSyncActivityAttempt = typeof skillSyncActivityAttemptsTable.$inferSelect;
