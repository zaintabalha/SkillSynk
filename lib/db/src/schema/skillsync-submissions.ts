import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncSubmissionsTable = pgTable("skillsync_submissions", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  technicalScore: integer("technical_score").notNull(),
  communicationScore: integer("communication_score").notNull(),
  overallScore: integer("overall_score").notNull(),
  technicalFeedback: text("technical_feedback").notNull(),
  communicationFeedback: text("communication_feedback").notNull(),
  nextSteps: jsonb("next_steps").$type<string[]>().notNull(),
  aiPowered: boolean("ai_powered").notNull().default(false),
  evaluationStatus: text("evaluation_status").notNull().default("ready"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncSubmissionSchema = createInsertSchema(skillSyncSubmissionsTable).omit({
  submittedAt: true,
});
export type InsertSkillSyncSubmission = z.infer<typeof insertSkillSyncSubmissionSchema>;
export type SkillSyncSubmission = typeof skillSyncSubmissionsTable.$inferSelect;
