import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable, workspacesTable } from "./auth";

/**
 * Read-only trail of user actions. Rows are only ever inserted — there is no
 * update or delete path through the API.
 */
export const auditLogTable = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  workspaceId: integer("workspace_id").references(() => workspacesTable.id, { onDelete: "set null" }),
  // e.g. "architecture.create", "architecture.rename", "architecture.regenerate_section",
  // "validation.run", "terraform.export", "architecture.delete", "auth.login", "auth.register"
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(), // "architecture" | "validation" | "user"
  entityId: integer("entity_id"),
  // Small structured payload (e.g. {"section":"terraform"} or {"from":"Old","to":"New"}).
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLogEntry = typeof auditLogTable.$inferSelect;
