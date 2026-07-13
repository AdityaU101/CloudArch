import { desc, eq } from "drizzle-orm";
import { db, architectureVersionsTable, type Architecture } from "@workspace/db";

/** The content fields that participate in versioning and diffing. */
export const CONTENT_FIELDS = [
  "title",
  "requirements",
  "provider",
  "diagram",
  "terraform",
  "costEstimate",
  "securityRecommendations",
  "highAvailabilityPlan",
  "databaseRecommendation",
  "kubernetesDeployment",
  "cicdPipeline",
  "monitoringSetup",
  "disasterRecovery",
  "threatModel",
] as const;

export type ContentField = (typeof CONTENT_FIELDS)[number];

export function contentSnapshot(row: Architecture): Record<string, string> {
  const snap: Record<string, string> = {};
  for (const f of CONTENT_FIELDS) snap[f] = String(row[f] ?? "");
  return snap;
}

/** Which content fields would change if `updates` were applied to `row`. */
export function changedContentFields(row: Architecture, updates: Record<string, unknown>): ContentField[] {
  return CONTENT_FIELDS.filter(
    (f) => typeof updates[f] === "string" && updates[f] !== String(row[f] ?? ""),
  );
}

/**
 * Record the pre-change state of an architecture as a new version. Call this
 * BEFORE applying the update so the snapshot preserves what is being replaced.
 */
export async function captureVersion(
  row: Architecture,
  changedFields: string[],
  reason: string,
  editorId: number | null,
): Promise<void> {
  const [latest] = await db
    .select({ versionNumber: architectureVersionsTable.versionNumber })
    .from(architectureVersionsTable)
    .where(eq(architectureVersionsTable.architectureId, row.id))
    .orderBy(desc(architectureVersionsTable.versionNumber))
    .limit(1);

  await db.insert(architectureVersionsTable).values({
    architectureId: row.id,
    versionNumber: (latest?.versionNumber ?? 0) + 1,
    editorId,
    reason,
    changedFields,
    snapshot: contentSnapshot(row),
  });
}
