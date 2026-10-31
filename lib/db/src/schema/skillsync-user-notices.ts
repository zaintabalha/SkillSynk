import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncUserNoticesTable = pgTable("skillsync_user_notices", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull().default("warning"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertSkillSyncUserNoticeSchema = createInsertSchema(skillSyncUserNoticesTable).omit({
  createdAt: true,
  readAt: true,
});
export type InsertSkillSyncUserNotice = z.infer<typeof insertSkillSyncUserNoticeSchema>;
export type SkillSyncUserNotice = typeof skillSyncUserNoticesTable.$inferSelect;
