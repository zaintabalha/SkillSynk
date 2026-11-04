import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncPushDevicesTable = pgTable("skillsync_push_devices", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  environment: text("environment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSkillSyncPushDeviceSchema = createInsertSchema(skillSyncPushDevicesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertSkillSyncPushDevice = z.infer<typeof insertSkillSyncPushDeviceSchema>;
export type SkillSyncPushDevice = typeof skillSyncPushDevicesTable.$inferSelect;
