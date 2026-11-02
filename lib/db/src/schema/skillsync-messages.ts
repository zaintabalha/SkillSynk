import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type SkillSyncReplySnapshot = {
  id: string;
  senderName: string;
  contentSnippet: string;
  mediaType: "image" | "audio" | null;
};

export const skillSyncMessagesTable = pgTable("skillsync_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  senderId: text("sender_id"),
  senderName: text("sender_name").notNull(),
  senderType: text("sender_type").notNull(),
  channel: text("channel").notNull().default("partner"),
  replyToMessageId: text("reply_to_message_id"),
  replyTo: jsonb("reply_to").$type<SkillSyncReplySnapshot | null>(),
  activityId: text("activity_id"),
  content: text("content").notNull(),
  mediaObjectPath: text("media_object_path"),
  mediaType: text("media_type"),
  mediaName: text("media_name"),
  mediaSize: integer("media_size"),
  mediaDurationSeconds: integer("media_duration_seconds"),
  transcript: text("transcript"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSyncMessageSchema = createInsertSchema(skillSyncMessagesTable).omit({
  createdAt: true,
});
export type InsertSkillSyncMessage = z.infer<typeof insertSkillSyncMessageSchema>;
export type SkillSyncMessage = typeof skillSyncMessagesTable.$inferSelect;
