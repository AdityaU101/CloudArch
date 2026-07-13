import { Router } from "express";
import { and, eq, count, gte, desc } from "drizzle-orm";
import { db, architecturesTable, type Architecture } from "@workspace/db";
import {
  GetArchitectureParams,
  UpdateArchitectureParams,
  UpdateArchitectureBody,
  DeleteArchitectureParams,
  SaveArchitectureBody,
  GenerateArchitectureBody,
  DownloadTerraformParams,
  RegenerateSectionParams,
  RegenerateSectionBody,
} from "@workspace/api-zod";
import { streamJsonCompletion } from "../lib/llm";
import {
  buildGenerationSystemPrompt,
  buildSectionRegenerationPrompt,
  providerDisplayName,
  resolveProvider,
  type SectionKey,
} from "../lib/prompts";
import { logAudit } from "../lib/audit";
import { captureVersion, changedContentFields } from "../lib/versions";

const router = Router();

/** Load one architecture, enforcing that it belongs to the requesting user. */
async function ownedArchitecture(userId: number, id: number): Promise<Architecture | undefined> {
  const [row] = await db
    .select()
    .from(architecturesTable)
    .where(and(eq(architecturesTable.id, id), eq(architecturesTable.userId, userId)));
  return row;
}

router.get("/architectures", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(architecturesTable)
      .where(eq(architecturesTable.userId, req.user!.id))
      .orderBy(desc(architecturesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list architectures");
    res.status(500).json({ error: "Failed to list architectures" });
  }
});

router.get("/architectures/stats", async (req, res) => {
  try {
    const mine = eq(architecturesTable.userId, req.user!.id);
    const [totalRow] = await db.select({ count: count() }).from(architecturesTable).where(mine);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentRow] = await db
      .select({ count: count() })
      .from(architecturesTable)
      .where(and(mine, gte(architecturesTable.createdAt, sevenDaysAgo)));
    const [latest] = await db
      .select({ title: architecturesTable.title })
      .from(architecturesTable)
      .where(mine)
      .orderBy(desc(architecturesTable.createdAt))
      .limit(1);

    res.json({
      totalCount: totalRow?.count ?? 0,
      recentCount: recentRow?.count ?? 0,
      latestTitle: latest?.title ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch stats");
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.post("/architectures/generate", async (req, res) => {
  const parsed = GenerateArchitectureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "requirements is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { requirements } = parsed.data;
  const provider = resolveProvider(parsed.data.provider);

  try {
    const stream = streamJsonCompletion({
      messages: [
        { role: "system", content: buildGenerationSystemPrompt(provider) },
        {
          role: "user",
          content: `Generate a complete ${providerDisplayName(provider)} cloud architecture for the following requirements:\n\n${requirements}`,
        },
      ],
    });

    let fullResponse = "";

    for await (const content of stream) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
    }

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(fullResponse);
    } catch {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: "AI returned invalid JSON" })}\n\n`,
      );
      res.end();
      return;
    }

    // The threat model arrives as structured JSON; transport and persist it as
    // a string like every other section so the architectures row stays all-text.
    if (result.threatModel !== undefined && typeof result.threatModel !== "string") {
      result.threatModel = JSON.stringify(result.threatModel);
    }
    result.provider = provider;

    logAudit(req, {
      actionType: "architecture.generate",
      entityType: "architecture",
      metadata: { provider, requirements: requirements.slice(0, 200) },
    });

    res.write(`data: ${JSON.stringify({ type: "done", result })}\n\n`);
    res.end();
  } catch (err: unknown) {
    req.log.error({ err }, "Groq generation failed");
    const message =
      err instanceof Error ? err.message : "AI generation failed";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

router.post("/architectures", async (req, res) => {
  const parsed = SaveArchitectureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  try {
    const [row] = await db
      .insert(architecturesTable)
      .values({ ...parsed.data, userId: req.user!.id, workspaceId: req.workspaceId ?? null })
      .returning();
    logAudit(req, {
      actionType: "architecture.create",
      entityType: "architecture",
      entityId: row.id,
      metadata: { title: row.title, provider: row.provider },
    });
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to save architecture");
    res.status(500).json({ error: "Failed to save architecture" });
  }
});

router.get("/architectures/:id", async (req, res) => {
  const params = GetArchitectureParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const row = await ownedArchitecture(req.user!.id, params.data.id);
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to get architecture");
    res.status(500).json({ error: "Failed to get architecture" });
  }
});

router.patch("/architectures/:id", async (req, res) => {
  const params = UpdateArchitectureParams.safeParse({
    id: Number(req.params.id),
  });
  const body = UpdateArchitectureBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  try {
    const existing = await ownedArchitecture(req.user!.id, params.data.id);
    if (!existing) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }

    // Version the pre-change state when content actually changes.
    const changed = changedContentFields(existing, body.data);
    if (changed.length > 0) {
      const reason =
        changed.length === 1 && changed[0] === "title"
          ? `Renamed to "${body.data.title}"`
          : `Edited ${changed.join(", ")}`;
      await captureVersion(existing, changed, reason, req.user!.id);
    }

    const [row] = await db
      .update(architecturesTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(architecturesTable.id, existing.id))
      .returning();

    if (changed.length > 0) {
      const isRename = changed.length === 1 && changed[0] === "title";
      logAudit(req, {
        actionType: isRename ? "architecture.rename" : "architecture.update",
        entityType: "architecture",
        entityId: existing.id,
        metadata: isRename
          ? { from: existing.title, to: body.data.title }
          : { fields: changed },
      });
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update architecture");
    res.status(500).json({ error: "Failed to update architecture" });
  }
});

router.delete("/architectures/:id", async (req, res) => {
  const params = DeleteArchitectureParams.safeParse({
    id: Number(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const existing = await ownedArchitecture(req.user!.id, params.data.id);
    if (!existing) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    await db.delete(architecturesTable).where(eq(architecturesTable.id, existing.id));
    logAudit(req, {
      actionType: "architecture.delete",
      entityType: "architecture",
      entityId: existing.id,
      metadata: { title: existing.title },
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete architecture");
    res.status(500).json({ error: "Failed to delete architecture" });
  }
});

router.get("/architectures/:id/terraform", async (req, res) => {
  const params = DownloadTerraformParams.safeParse({
    id: Number(req.params.id),
  });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const row = await ownedArchitecture(req.user!.id, params.data.id);
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
    logAudit(req, {
      actionType: "terraform.export",
      entityType: "architecture",
      entityId: row.id,
      metadata: { title: row.title },
    });
    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="main.tf"`,
    );
    res.send(row.terraform);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch terraform");
    res.status(500).json({ error: "Failed to fetch terraform" });
  }
});

router.post("/architectures/:id/regenerate-section", async (req, res) => {
  const params = RegenerateSectionParams.safeParse({ id: Number(req.params.id) });
  const body = RegenerateSectionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const section = body.data.section as SectionKey;

  let row: Architecture | undefined;
  try {
    row = await ownedArchitecture(req.user!.id, params.data.id);
  } catch (err) {
    req.log.error({ err }, "Failed to load architecture");
    res.status(500).json({ error: "Failed to load architecture" });
    return;
  }
  if (!row) {
    res.status(404).json({ error: "Architecture not found" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const provider = resolveProvider(row.provider);

  try {
    const stream = streamJsonCompletion({
      messages: [
        {
          role: "system",
          content: buildSectionRegenerationPrompt(provider, section, {
            requirements: row.requirements,
            diagram: row.diagram,
            current: String(row[section] ?? ""),
            instructions: body.data.instructions,
          }),
        },
        {
          role: "user",
          content: `Regenerate the "${section}" section of this ${providerDisplayName(provider)} architecture now.`,
        },
      ],
    });

    let fullResponse = "";
    for await (const content of stream) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
    }

    let parsedResult: Record<string, unknown>;
    try {
      parsedResult = JSON.parse(fullResponse);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", error: "AI returned invalid JSON" })}\n\n`);
      res.end();
      return;
    }

    let content = parsedResult[section];
    if (content !== undefined && typeof content !== "string") {
      content = JSON.stringify(content); // threatModel arrives structured
    }
    if (typeof content !== "string" || !content.trim()) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "AI response did not contain the requested section" })}\n\n`);
      res.end();
      return;
    }

    // Version the old state, then persist ONLY the regenerated column.
    await captureVersion(row, [section], `Regenerated ${section}`, req.user!.id);
    const [updated] = await db
      .update(architecturesTable)
      .set({ [section]: content, updatedAt: new Date() })
      .where(eq(architecturesTable.id, row.id))
      .returning();

    logAudit(req, {
      actionType: "architecture.regenerate_section",
      entityType: "architecture",
      entityId: row.id,
      metadata: { section },
    });

    res.write(`data: ${JSON.stringify({ type: "done", result: { section, content, architecture: updated } })}\n\n`);
    res.end();
  } catch (err: unknown) {
    req.log.error({ err }, "Section regeneration failed");
    const message = err instanceof Error ? err.message : "Section regeneration failed";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

export default router;
