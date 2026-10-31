import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncSuspensionsTable = pgTable("skillsync_suspensions", {
  userId: text("user_id").primaryKey(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
});

export const insertSkillSyncSuspensionSchema = createInsertSchema(skillSyncSuspensionsTable).omit({
  startsAt: true,
});
export type InsertSkillSyncSuspension = z.infer<typeof insertSkillSyncSuspensionSchema>;
export type SkillSyncSuspension = typeof skillSyncSuspensionsTable.$inferSelect;
