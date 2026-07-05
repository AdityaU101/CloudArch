import { Router } from "express";
import { eq, count, gte, desc } from "drizzle-orm";
import { db, architecturesTable } from "@workspace/db";
import {
  GetArchitectureParams,
  UpdateArchitectureParams,
  UpdateArchitectureBody,
  DeleteArchitectureParams,
  SaveArchitectureBody,
  GenerateArchitectureBody,
  DownloadTerraformParams,
} from "@workspace/api-zod";
import { groq, GROQ_MODEL } from "../lib/groq";
import {
  buildGenerationSystemPrompt,
  providerDisplayName,
  resolveProvider,
} from "../lib/prompts";

const router = Router();

router.get("/architectures", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(architecturesTable)
      .orderBy(desc(architecturesTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list architectures");
    res.status(500).json({ error: "Failed to list architectures" });
  }
});

router.get("/architectures/stats", async (req, res) => {
  try {
    const [totalRow] = await db.select({ count: count() }).from(architecturesTable);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentRow] = await db
      .select({ count: count() })
      .from(architecturesTable)
      .where(gte(architecturesTable.createdAt, sevenDaysAgo));
    const [latest] = await db
      .select({ title: architecturesTable.title })
      .from(architecturesTable)
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
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: buildGenerationSystemPrompt(provider) },
        {
          role: "user",
          content: `Generate a complete ${providerDisplayName(provider)} cloud architecture for the following requirements:\n\n${requirements}`,
        },
      ],
      stream: true,
      max_tokens: 8192,
      response_format: { type: "json_object" },
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
      }
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
      .values(parsed.data)
      .returning();
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
    const [row] = await db
      .select()
      .from(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id));
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
    const [row] = await db
      .update(architecturesTable)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(architecturesTable.id, params.data.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
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
    const deleted = await db
      .delete(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id))
      .returning();
    if (!deleted.length) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
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
    const [row] = await db
      .select()
      .from(architecturesTable)
      .where(eq(architecturesTable.id, params.data.id));
    if (!row) {
      res.status(404).json({ error: "Architecture not found" });
      return;
    }
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

export default router;
