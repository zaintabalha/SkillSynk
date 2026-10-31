import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const skillSyncMessagesTable = pgTable("skillsync_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  senderId: text("sender_id"),
  senderName: text("sender_name").notNull(),
  senderType: text("sender_type").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncMessageSchema = createInsertSchema(skillSyncMessagesTable).omit({
  createdAt: true,
});
export type InsertSkillSyncMessage = z.infer<typeof insertSkillSyncMessageSchema>;
export type SkillSyncMessage = typeof skillSyncMessagesTable.$inferSelect;
