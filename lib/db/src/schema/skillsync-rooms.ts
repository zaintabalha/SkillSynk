import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SkillSyncCurriculum = {
  title: string;
  description: string;
  goal: string;
  stages: string[];
  learningPaths?: {
    userA: {
      title: string;
      goal: string;
      stages: string[];
    };
    userB: {
      title: string;
      goal: string;
      stages: string[];
    };
  };
  aiPowered?: boolean;
  generationStatus?: "pending" | "ready";
};

export type SkillSyncChallenge = {
  id: string;
  prompt: string;
  hint: string;
  dayNumber: number;
  completed: boolean;
  aiPowered: boolean;
};

export const skillSyncRoomsTable = pgTable("skillsync_rooms", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull(),
  projectTitle: text("project_title").notNull(),
  status: text("status").notNull().default("active"),
  progress: integer("progress").notNull().default(8),
  isDemo: boolean("is_demo").notNull().default(false),
  curriculum: jsonb("curriculum").$type<SkillSyncCurriculum>().notNull(),
  challenge: jsonb("challenge").$type<SkillSyncChallenge | null>(),
  challengeDay: integer("challenge_day").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSkillSyncRoomSchema = createInsertSchema(skillSyncRoomsTable).omit({
  updatedAt: true,
});
export type InsertSkillSyncRoom = z.infer<typeof insertSkillSyncRoomSchema>;
export type SkillSyncRoom = typeof skillSyncRoomsTable.$inferSelect;
