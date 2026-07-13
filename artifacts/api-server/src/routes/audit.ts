import { Router } from "express";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { db, auditLogTable, usersTable } from "@workspace/db";

const router = Router();

/**
 * Read-only audit trail. Entries are scoped to the requesting user's own
 * actions; there is no write/update/delete surface through the API.
 */
router.get("/audit-logs", async (req, res) => {
  const architectureId = req.query.architectureId ? Number(req.query.architectureId) : undefined;
  const limitRaw = req.query.limit ? Number(req.query.limit) : 50;
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  if (architectureId !== undefined && !Number.isInteger(architectureId)) {
    res.status(400).json({ error: "Invalid architectureId" });
    return;
  }

  try {
    const conditions: SQL[] = [eq(auditLogTable.userId, req.user!.id)];
    if (architectureId !== undefined) {
      conditions.push(
        eq(auditLogTable.entityType, "architecture"),
        eq(auditLogTable.entityId, architectureId),
      );
    }

    const rows = await db
      .select({
        id: auditLogTable.id,
        actionType: auditLogTable.actionType,
        entityType: auditLogTable.entityType,
        entityId: auditLogTable.entityId,
        metadata: auditLogTable.metadata,
        createdAt: auditLogTable.createdAt,
        userName: usersTable.name,
      })
      .from(auditLogTable)
      .leftJoin(usersTable, eq(auditLogTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogTable.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to query audit logs");
    res.status(500).json({ error: "Failed to query audit logs" });
  }
});

export default router;
