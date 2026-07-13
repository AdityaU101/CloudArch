import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { architecturesTable } from "./architectures";
import { usersTable } from "./auth";

/**
 * A point-in-time snapshot of an architecture's content fields, captured just
 * before a meaningful change (rename, section edit, regeneration, rollback).
 * Snapshots store the full content — rows are tens of KB at most, and a full
 * snapshot makes rollback a single restore instead of a delta replay.
 */
export const architectureVersionsTable = pgTable("architecture_versions", {
  id: serial("id").primaryKey(),
  architectureId: integer("architecture_id")
    .notNull()
    .references(() => architecturesTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  editorId: integer("editor_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Human-readable change reason, e.g. "Renamed", "Regenerated terraform", "Rollback to v3".
  reason: text("reason").notNull(),
  // Which content fields differ from the previous state; drives the compare UI.
  changedFields: jsonb("changed_fields").$type<string[]>().notNull(),
  // Full snapshot of the content fields as they were BEFORE the change.
  snapshot: jsonb("snapshot").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ArchitectureVersion = typeof architectureVersionsTable.$inferSelect;
