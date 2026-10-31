import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncProfilesTable = pgTable("skillsync_profiles", {
  userId: text("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  university: text("university").notNull(),
  teachSkill: text("teach_skill").notNull(),
  learnSkill: text("learn_skill").notNull(),
  bio: text("bio").notNull().default(""),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSkillSyncProfileSchema = createInsertSchema(skillSyncProfilesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSkillSyncProfile = z.infer<typeof insertSkillSyncProfileSchema>;
export type SkillSyncProfile = typeof skillSyncProfilesTable.$inferSelect;
