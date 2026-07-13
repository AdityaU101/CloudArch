import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logger } from "./logger";

/**
 * LLM provider chain. Every provider speaks the OpenAI-compatible API, so a
 * fallback is just another base URL + key + model. Providers are tried in
 * order; a request fails over to the next provider only when the failure
 * happens BEFORE any content has been streamed (rate limit, auth, 5xx,
 * network) — once chunks have been forwarded to the client, switching
 * providers mid-response would corrupt the output, so mid-stream errors
 * propagate instead.
 */
interface LlmProvider {
  name: string;
  client: OpenAI;
  model: string;
}

function buildChain(): LlmProvider[] {
  const chain: LlmProvider[] = [];

  const groqKey = process.env["GROQ_API_KEY"];
  if (groqKey) {
    chain.push({
      name: "groq",
      client: new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" }),
      model: "llama-3.3-70b-versatile",
    });
  }

  const openrouterKey = process.env["OPENROUTER_API_KEY"];
  if (openrouterKey) {
    chain.push({
      name: "openrouter",
      client: new OpenAI({ apiKey: openrouterKey, baseURL: "https://openrouter.ai/api/v1" }),
      model: "meta-llama/llama-3.3-70b-instruct",
    });
  }

  if (chain.length === 0) {
    throw new Error(
      "No LLM provider configured. Set GROQ_API_KEY and/or OPENROUTER_API_KEY in your environment.",
    );
  }
  return chain;
}

const CHAIN = buildChain();

/** A 400 means the request itself is bad and would fail on every provider. */
function isRetryable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    const status = err.status;
    return status === undefined || status === 401 || status === 403 || status === 408 || status === 429 || status >= 500;
  }
  // Network-level failures (connection refused, DNS, timeout) have no status.
  return true;
}

export interface StreamParams {
  messages: ChatCompletionMessageParam[];
  maxTokens?: number;
}

/**
 * Stream a JSON-mode chat completion through the provider chain. Yields
 * content deltas; the caller assembles and parses the full response.
 */
export async function* streamJsonCompletion(params: StreamParams): AsyncGenerator<string> {
  let lastError: unknown;

  for (let i = 0; i < CHAIN.length; i++) {
    const provider = CHAIN[i];
    let yieldedAny = false;

    try {
      const stream = await provider.client.chat.completions.create({
        model: provider.model,
        messages: params.messages,
        stream: true,
        max_tokens: params.maxTokens ?? 8192,
        response_format: { type: "json_object" },
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yieldedAny = true;
          yield content;
        }
      }
      return; // completed successfully
    } catch (err) {
      lastError = err;
      const canFallOver = !yieldedAny && isRetryable(err) && i < CHAIN.length - 1;
      if (!canFallOver) throw err;
      logger.warn(
        { err, provider: provider.name, next: CHAIN[i + 1].name },
        "LLM provider failed before first chunk; falling back",
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error("All LLM providers failed");
}
