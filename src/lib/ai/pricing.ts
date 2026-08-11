/**
 * Model selection and cost accounting.
 *
 * The original spec named gemini-2.5-pro and gemini-2.5-flash. Both now return
 * "no longer available to new users" on this project's API key, so the pipeline
 * targets the current generation instead. See ADR 9 in the README.
 *
 * Model ids are PINNED, not aliases. `gemini-pro-latest` would silently change
 * the underlying model, and a score produced by a different model is no more
 * comparable to last week's than one produced by a different prompt — which is
 * the exact failure mode `prompt_version` exists to prevent. Both the pinned id
 * and the prompt version are recorded on every evaluation row.
 *
 * Each is overridable by env so a withdrawn preview is a config change rather
 * than a redeploy.
 */

export const EVALUATION_MODEL = process.env.GEMINI_EVAL_MODEL ?? "gemini-3.1-pro-preview";
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL ?? "gemini-3.5-flash";

export type GeminiModel = string;

type PriceBand = {
  /** Applies while input tokens are at or below this; null = no upper bound. */
  upToInputTokens: number | null;
  inputPerMillion: number;
  outputPerMillion: number;
};

type ModelPricing = {
  bands: PriceBand[];
  /**
   * Whether these rates have been checked against Google's published pricing.
   *
   * Marked honestly rather than assumed: an unverified rate produces a cost
   * figure that looks authoritative on the admin dashboard and is not. Unverified
   * models warn once per process so the gap is visible rather than silent.
   */
  verified: boolean;
};

/** VERIFY: https://ai.google.dev/gemini-api/docs/pricing */
const PRICING: Record<string, ModelPricing> = {
  // Retained so historical rows priced under 2.5 still compute correctly.
  "gemini-2.5-pro": {
    verified: true,
    bands: [
      { upToInputTokens: 200_000, inputPerMillion: 1.25, outputPerMillion: 10.0 },
      { upToInputTokens: null, inputPerMillion: 2.5, outputPerMillion: 15.0 },
    ],
  },
  "gemini-2.5-flash": {
    verified: true,
    bands: [{ upToInputTokens: null, inputPerMillion: 0.3, outputPerMillion: 2.5 }],
  },

  // Estimated from the 2.5 tier structure — NOT confirmed against published
  // pricing for this generation. Recorded costs are indicative until checked.
  "gemini-3.1-pro-preview": {
    verified: false,
    bands: [
      { upToInputTokens: 200_000, inputPerMillion: 1.25, outputPerMillion: 10.0 },
      { upToInputTokens: null, inputPerMillion: 2.5, outputPerMillion: 15.0 },
    ],
  },
  "gemini-3.5-flash": {
    verified: false,
    bands: [{ upToInputTokens: null, inputPerMillion: 0.3, outputPerMillion: 2.5 }],
  },
  "gemini-3.6-flash": {
    verified: false,
    bands: [{ upToInputTokens: null, inputPerMillion: 0.3, outputPerMillion: 2.5 }],
  },
};

/** Fallback for a model we have no entry for: priced as pro, and never silent. */
const UNKNOWN_MODEL_PRICING: ModelPricing = {
  verified: false,
  bands: [{ upToInputTokens: null, inputPerMillion: 2.5, outputPerMillion: 15.0 }],
};

const warned = new Set<string>();

function pricingFor(model: string): ModelPricing {
  const pricing = PRICING[model];

  if (!pricing) {
    if (!warned.has(model)) {
      warned.add(model);
      console.warn(
        `[pricing] no rate card for "${model}" — costs are a worst-case estimate. ` +
          `Add it to src/lib/ai/pricing.ts.`,
      );
    }
    return UNKNOWN_MODEL_PRICING;
  }

  if (!pricing.verified && !warned.has(model)) {
    warned.add(model);
    console.warn(
      `[pricing] rates for "${model}" are unverified estimates — check ` +
        `https://ai.google.dev/gemini-api/docs/pricing before trusting cost figures.`,
    );
  }

  return pricing;
}

export function isPricingVerified(model: string): boolean {
  return PRICING[model]?.verified ?? false;
}

/**
 * Cost in USD for one call. Rounded to 6dp to match the `numeric(10,6)` column,
 * so the stored value is exactly what we computed rather than whatever Postgres
 * truncated it to.
 *
 * `outputTokens` must include thinking tokens — these models bill them as output,
 * and on a short response they can outnumber visible output more than tenfold.
 */
export function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const { bands } = pricingFor(model);
  const band =
    bands.find((b) => b.upToInputTokens === null || inputTokens <= b.upToInputTokens) ??
    bands[bands.length - 1];

  const cost =
    (inputTokens / 1_000_000) * band.inputPerMillion +
    (outputTokens / 1_000_000) * band.outputPerMillion;

  return Math.round(cost * 1_000_000) / 1_000_000;
}
