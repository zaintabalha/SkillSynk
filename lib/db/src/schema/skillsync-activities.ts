import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SkillSyncActivityContent = {
  questions?: Array<{
    id: string;
    prompt: string;
    choices: string[];
    answerIndex: number;
    explanation: string;
  }>;
  flashcards?: Array<{ front: string; back: string }>;
  simulator?: {
    mode: "coding" | "language";
    scenario: string;
    prompt: string;
    starter: string;
    expected: string;
    hint: string;
  };
};

export const skillSyncActivitiesTable = pgTable("skillsync_activities", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  instructions: text("instructions").notNull(),
  content: jsonb("content").$type<SkillSyncActivityContent>().notNull(),
  createdBy: text("created_by"),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncActivitySchema = createInsertSchema(skillSyncActivitiesTable).omit({
  createdAt: true,
});
export type InsertSkillSyncActivity = z.infer<typeof insertSkillSyncActivitySchema>;
export type SkillSyncActivity = typeof skillSyncActivitiesTable.$inferSelect;
