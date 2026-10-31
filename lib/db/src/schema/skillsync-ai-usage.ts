import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncAiUsageTable = pgTable("skillsync_ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  feature: text("feature").notNull(),
  aiPowered: boolean("ai_powered").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncAiUsageSchema = createInsertSchema(skillSyncAiUsageTable).omit({
  createdAt: true,
});
export type InsertSkillSyncAiUsage = z.infer<typeof insertSkillSyncAiUsageSchema>;
export type SkillSyncAiUsage = typeof skillSyncAiUsageTable.$inferSelect;
