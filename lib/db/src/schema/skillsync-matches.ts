import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncMatchesTable = pgTable("skillsync_matches", {
  id: text("id").primaryKey(),
  userAId: text("user_a_id").notNull(),
  userBId: text("user_b_id").notNull(),
  rationale: text("rationale").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncMatchSchema = createInsertSchema(skillSyncMatchesTable).omit({
  createdAt: true,
});
export type InsertSkillSyncMatch = z.infer<typeof insertSkillSyncMatchSchema>;
export type SkillSyncMatch = typeof skillSyncMatchesTable.$inferSelect;
