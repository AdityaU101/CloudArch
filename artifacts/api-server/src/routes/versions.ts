import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  architecturesTable,
  architectureVersionsTable,
  usersTable,
  type Architecture,
} from "@workspace/db";
import { logAudit } from "../lib/audit";
import { captureVersion, contentSnapshot, CONTENT_FIELDS } from "../lib/versions";

const router = Router();

async function ownedArchitecture(userId: number, id: number): Promise<Architecture | undefined> {
  const [row] = await db
    .select()
    .from(architecturesTable)
    .where(and(eq(architecturesTable.id, id), eq(architecturesTable.userId, userId)));
  return row;
}

router.get("/architectures/:id/versions", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const arch = await ownedArchitecture(req.user!.id, id);
    if (!arch) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }

    const rows = await db
      .select({
        id: architectureVersionsTable.id,
        architectureId: architectureVersionsTable.architectureId,
        versionNumber: architectureVersionsTable.versionNumber,
        reason: architectureVersionsTable.reason,
        changedFields: architectureVersionsTable.changedFields,
        createdAt: architectureVersionsTable.createdAt,
        editorName: usersTable.name,
      })
      .from(architectureVersionsTable)
      .leftJoin(usersTable, eq(architectureVersionsTable.editorId, usersTable.id))
      .where(eq(architectureVersionsTable.architectureId, id))
      .orderBy(desc(architectureVersionsTable.versionNumber));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list versions");
    res.status(500).json({ error: "Failed to list versions" });
  }
});

router.get("/architectures/:id/versions/:versionId", async (req, res) => {
  const id = Number(req.params.id);
  const versionId = Number(req.params.versionId);
  if (!Number.isInteger(id) || !Number.isInteger(versionId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const arch = await ownedArchitecture(req.user!.id, id);
    if (!arch) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }

    const [row] = await db
      .select({
        id: architectureVersionsTable.id,
        architectureId: architectureVersionsTable.architectureId,
        versionNumber: architectureVersionsTable.versionNumber,
        reason: architectureVersionsTable.reason,
        changedFields: architectureVersionsTable.changedFields,
        snapshot: architectureVersionsTable.snapshot,
        createdAt: architectureVersionsTable.createdAt,
        editorName: usersTable.name,
      })
      .from(architectureVersionsTable)
      .leftJoin(usersTable, eq(architectureVersionsTable.editorId, usersTable.id))
      .where(
        and(
          eq(architectureVersionsTable.id, versionId),
          eq(architectureVersionsTable.architectureId, id),
        ),
      );

    if (!row) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get version");
    res.status(500).json({ error: "Failed to get version" });
  }
});

router.post("/architectures/:id/versions/:versionId/rollback", async (req, res) => {
  const id = Number(req.params.id);
  const versionId = Number(req.params.versionId);
  if (!Number.isInteger(id) || !Number.isInteger(versionId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const arch = await ownedArchitecture(req.user!.id, id);
    if (!arch) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }

    const [version] = await db
      .select()
      .from(architectureVersionsTable)
      .where(
        and(
          eq(architectureVersionsTable.id, versionId),
          eq(architectureVersionsTable.architectureId, id),
        ),
      );
    if (!version) {
      res.status(404).json({ error: "Version not found" });
      return;
    }

    // Only restore fields that actually differ from the current state.
    const current = contentSnapshot(arch);
    const restore: Record<string, string> = {};
    const changed: string[] = [];
    for (const f of CONTENT_FIELDS) {
      const value = version.snapshot[f];
      if (typeof value === "string" && value !== current[f]) {
        restore[f] = value;
        changed.push(f);
      }
    }

    if (changed.length === 0) {
      res.json(arch); // nothing to do — already identical
      return;
    }

    // Preserve the pre-rollback state as its own version so rollback is undoable.
    await captureVersion(arch, changed, `Rollback to v${version.versionNumber}`, req.user!.id);

    const [updated] = await db
      .update(architecturesTable)
      .set({ ...restore, updatedAt: new Date() })
      .where(eq(architecturesTable.id, arch.id))
      .returning();

    logAudit(req, {
      actionType: "architecture.rollback",
      entityType: "architecture",
      entityId: arch.id,
      metadata: { toVersion: version.versionNumber, fields: changed },
    });

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Rollback failed");
    res.status(500).json({ error: "Rollback failed" });
  }
});

export default router;
