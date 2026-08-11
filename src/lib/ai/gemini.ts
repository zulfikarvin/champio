import "server-only";

import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { computeCostUsd, type GeminiModel } from "@/lib/ai/pricing";

/**
 * The single door to the LLM.
 *
 * Every call through here returns validated data plus the token counts and cost
 * it incurred, because the alternative — recording usage at the call site — means
 * the one path someone forgets is the one that silently under-reports spend.
 *
 * Validation is not optional and not "parse and hope": the caller supplies a Zod
 * schema, we retry once with the validation error fed back to the model, and then
 * we give up with the error preserved. A model that cannot produce the shape
 * twice will not produce it on the fifth attempt either, and each attempt costs
 * real money.
 */

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type GenerateResult<T> = {
  data: T;
  usage: Usage;
  /** 1 = first attempt succeeded, 2 = the retry did. Recorded per evaluation. */
  attempts: number;
  /** Echoed back so the caller records exactly which model produced this. */
  model: GeminiModel;
};

export class LlmError extends Error {
  readonly usage: Usage;
  constructor(message: string, usage: Usage) {
    super(message);
    this.name = "LlmError";
    this.usage = usage;
  }
}

const EMPTY_USAGE: Usage = { inputTokens: 0, outputTokens: 0, costUsd: 0 };

function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: Math.round((a.costUsd + b.costUsd) * 1_000_000) / 1_000_000,
  };
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "not-needed-until-phase-2") {
    throw new Error(
      "GEMINI_API_KEY is not set in .env.local — get one at https://aistudio.google.com/apikey",
    );
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Models wrap JSON in prose or fences often enough that stripping it is cheaper
 * than another round trip. We ask for `application/json`, but belt and braces.
 */
function extractJson(raw: string): string {
  const text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();

  const start = text.search(/[[{]/);
  if (start === -1) return text;

  const end = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  return end > start ? text.slice(start, end + 1) : text.slice(start);
}

export async function generateJson<T>({
  model,
  systemInstruction,
  prompt,
  schema,
  temperature = 0.2,
  maxOutputTokens = 16_384,
}: {
  model: GeminiModel;
  systemInstruction: string;
  prompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<GenerateResult<T>> {
  const ai = getClient();
  let usage = EMPTY_USAGE;
  let lastError = "";

  // Two attempts: the original, then one repair pass carrying the exact
  // validation failure. See the note above on why not more.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const contents =
      attempt === 1
        ? prompt
        : `${prompt}\n\n---\nYour previous response was rejected by schema validation:\n${lastError}\n\nReturn corrected JSON only. No commentary, no code fences.`;

    let text: string;
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      });

      const meta = response.usageMetadata;
      const inputTokens = meta?.promptTokenCount ?? 0;
      // Thinking tokens are billed as output; omitting them under-reports cost.
      const outputTokens =
        (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0);

      usage = addUsage(usage, {
        inputTokens,
        outputTokens,
        costUsd: computeCostUsd(model, inputTokens, outputTokens),
      });

      text = response.text ?? "";
    } catch (cause) {
      // A transport/API failure is not a schema problem — no point retrying with
      // a "your JSON was invalid" message attached.
      throw new LlmError(
        `Gemini request failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        usage,
      );
    }

    if (text.trim().length === 0) {
      lastError = "The response was empty.";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJson(text));
    } catch (cause) {
      lastError = `Response was not valid JSON: ${
        cause instanceof Error ? cause.message : String(cause)
      }`;
      continue;
    }

    const result = schema.safeParse(parsed);
    if (result.success) {
      return { data: result.data, usage, attempts: attempt, model };
    }

    lastError = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
  }

  throw new LlmError(
    `Model output failed validation after 2 attempts:\n${lastError}`,
    usage,
  );
}
