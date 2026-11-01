// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./skillsync-profiles";
export * from "./skillsync-matches";
export * from "./skillsync-rooms";
export * from "./skillsync-messages";
export * from "./skillsync-submissions";
export * from "./skillsync-reports";
export * from "./skillsync-ai-usage";
export * from "./skillsync-admin-actions";
export * from "./skillsync-suspensions";
export * from "./skillsync-user-notices";
export * from "./skillsync-activities";
export * from "./skillsync-activity-attempts";