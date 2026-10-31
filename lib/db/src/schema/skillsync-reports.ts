import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncReportsTable = pgTable("skillsync_reports", {
  id: text("id").primaryKey(),
  reporterUserId: text("reporter_user_id").notNull(),
  reportedUserId: text("reported_user_id"),
  roomId: text("room_id"),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  details: text("details").notNull(),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSkillSyncReportSchema = createInsertSchema(skillSyncReportsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSkillSyncReport = z.infer<typeof insertSkillSyncReportSchema>;
export type SkillSyncReport = typeof skillSyncReportsTable.$inferSelect;
