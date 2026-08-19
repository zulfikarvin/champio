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
 *
 * Calls are made as reproducible as the API allows — temperature 0 and a fixed
 * seed — because this app compares scores across versions, and a score that
 * drifts on its own is worse than no score at all.
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

/**
 * One fixed seed for every call, so a repeated evaluation lands on the same
 * sample. The value is arbitrary; that it never changes is the point.
 */
const DETERMINISTIC_SEED = 7;

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
  temperature = 0,
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
          // Fixed seed, paired with temperature 0. Without both, the same
          // document scored twice comes back with different numbers — a real
          // case measured 59.5 then 72.5 on byte-identical text, with one
          // criterion swinging 4 to 7. A score that moves on its own makes the
          // v1-to-v2 comparison meaningless, which is the product's core claim.
          //
          // This reduces variance rather than abolishing it: providers do not
          // guarantee reproducibility, and thinking models are the least
          // predictable of all. The hard guarantee for unchanged documents is in
          // the pipeline, which reuses the previous result instead of re-scoring.
          seed: DETERMINISTIC_SEED,
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
