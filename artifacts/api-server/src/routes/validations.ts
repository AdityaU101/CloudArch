import { Router } from "express";
import { ValidateInfrastructureBody } from "@workspace/api-zod";
import { groq, GROQ_MODEL } from "../lib/groq";
import { buildValidationSystemPrompt, validationFormatLabel } from "../lib/prompts";

const router = Router();

// Cap the analyzed source so a huge upload can't blow the model context.
const MAX_SOURCE_CHARS = 60_000;

router.post("/validations/analyze", async (req, res) => {
  const parsed = ValidateInfrastructureBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "source and format are required" });
    return;
  }

  const { source, format } = parsed.data;
  if (!source.trim()) {
    res.status(400).json({ error: "source must not be empty" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const truncated = source.length > MAX_SOURCE_CHARS;
  const body = truncated ? source.slice(0, MAX_SOURCE_CHARS) : source;

  try {
    const stream = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: buildValidationSystemPrompt(format) },
        {
          role: "user",
          content: `Analyze the following ${validationFormatLabel(format)}${truncated ? " (truncated to the first 60,000 characters)" : ""}:\n\n${body}`,
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

    res.write(`data: ${JSON.stringify({ type: "done", result })}\n\n`);
    res.end();
  } catch (err: unknown) {
    req.log.error({ err }, "Groq validation failed");
    const message = err instanceof Error ? err.message : "AI validation failed";
    res.write(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    res.end();
  }
});

export default router;
