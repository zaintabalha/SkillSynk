import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncAdminActionsTable = pgTable("skillsync_admin_actions", {
  id: text("id").primaryKey(),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  roomId: text("room_id"),
  reportId: text("report_id"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncAdminActionSchema = createInsertSchema(skillSyncAdminActionsTable).omit({
  createdAt: true,
});
export type InsertSkillSyncAdminAction = z.infer<typeof insertSkillSyncAdminActionSchema>;
export type SkillSyncAdminAction = typeof skillSyncAdminActionsTable.$inferSelect;
