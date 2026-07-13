import type { Request } from "express";
import { db, auditLogTable } from "@workspace/db";

interface AuditEvent {
  actionType: string;
  entityType: string;
  entityId?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit insert. Never throws — a failed audit write must not
 * break the user-facing action it describes.
 */
export function logAudit(req: Request, event: AuditEvent): void {
  db.insert(auditLogTable)
    .values({
      userId: req.user?.id ?? null,
      workspaceId: req.workspaceId ?? null,
      actionType: event.actionType,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? {},
    })
    .catch((err) => {
      req.log.warn({ err, actionType: event.actionType }, "Audit log write failed");
    });
}
