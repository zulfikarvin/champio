import { z } from "zod";
import type { Rubric } from "@/lib/schemas/rubric";

/**
 * The evaluation result contract — what the LLM must return, and what the report
 * and delta screens are allowed to assume.
 *
 * Two deliberate choices here:
 *
 * 1. `overall_score` is NOT taken from the model. The model returns per-criterion
 *    judgements; we compute the weighted mean in TypeScript (see
 *    `computeOverallScore`). Language models are unreliable at arithmetic, and a
 *    score that drifts from its own components makes the delta view untrustworthy.
 *    The field exists in the schema because we still ask for it and compare — a
 *    large gap is a useful signal that the model misread the rubric.
 *
 * 2. The result must cover the rubric exactly — same criterion keys, no extras,
 *    none missing. That is checked by `evaluationResultSchemaFor(rubric)` rather
 *    than assumed, because everything downstream (per-criterion deltas, the admin
 *    "median lift per criterion" metric) joins on those keys.
 */

export const fixSchema = z.object({
  priority: z.number().int().min(1).max(5),
  action: z.string().min(1),
  /** Where in the document to apply it — "slide 4", "page 2", "§3.1". */
  where: z.string().min(1),
});

export const criterionResultSchema = z.object({
  key: z.string().min(1),
  score: z.number().min(0).max(10),
  /** Quotes or slide/page references lifted from the submission. Requiring the
   *  model to cite is what keeps feedback specific instead of horoscopic. */
  evidence: z.array(z.string().min(1)).default([]),
  strengths: z.array(z.string().min(1)).default([]),
  issues: z.array(z.string().min(1)).default([]),
  fixes: z.array(fixSchema).default([]),
});

export const formatComplianceSchema = z.object({
  rule: z.string().min(1),
  pass: z.boolean(),
  note: z.string().default(""),
});

export const TYPO_KINDS = [
  "spelling",
  "grammar",
  "punctuation",
  "consistency",
  "formatting",
] as const;

/**
 * A mechanical error found in the document.
 *
 * `quote` is required and must be text that actually appears in the submission.
 * Without it a correction is unverifiable — the team cannot find what to change,
 * and cannot tell an invented error from a real one. The quote is what makes this
 * section trustworthy, so it is a schema requirement rather than a request.
 */
export const typoSchema = z.object({
  /** Where to find it — "page 3", "slide 7". */
  where: z.string().min(1),
  /** The text exactly as written in the document. */
  quote: z.string().min(1).max(300),
  /** The same text, corrected. */
  correction: z.string().min(1).max(300),
  kind: z.enum(TYPO_KINDS),
});

/** Shape-only schema: use where the rubric is not in hand (e.g. reading an old
 *  result row whose rubric has since been superseded). */
export const evaluationResultSchema = z.object({
  overall_score: z.number().min(0).max(100),
  criteria_results: z.array(criterionResultSchema).min(1),
  format_compliance: z.array(formatComplianceSchema).default([]),
  /**
   * Mechanical errors to fix. Defaulted rather than required so reports produced
   * before this field existed still parse — the report screen simply shows no
   * typo section for them.
   */
  typos: z.array(typoSchema).max(40).default([]),
  summary: z.string().min(1),
});

export type Fix = z.infer<typeof fixSchema>;
export type Typo = z.infer<typeof typoSchema>;
export type TypoKind = (typeof TYPO_KINDS)[number];
export type CriterionResult = z.infer<typeof criterionResultSchema>;
export type FormatCompliance = z.infer<typeof formatComplianceSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

/**
 * The schema actually used to validate LLM output: the shape above, plus the
 * requirement that criteria_results maps 1:1 onto this rubric's criteria.
 */
export function evaluationResultSchemaFor(rubric: Rubric) {
  const expected = new Set(rubric.criteria.map((c) => c.key));

  return evaluationResultSchema.superRefine((result, ctx) => {
    const got = new Set(result.criteria_results.map((r) => r.key));

    const missing = [...expected].filter((k) => !got.has(k));
    if (missing.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria_results"],
        message: `missing criteria: ${missing.join(", ")}`,
      });
    }

    const unexpected = [...got].filter((k) => !expected.has(k));
    if (unexpected.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria_results"],
        message: `unknown criteria: ${unexpected.join(", ")}`,
      });
    }

    if (result.criteria_results.length !== got.size) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria_results"],
        message: "duplicate criterion keys in result",
      });
    }
  });
}

/**
 * Weighted mean of per-criterion scores, expressed on 0–100.
 *
 * Criteria are scored 0–10 and weights sum to 1.0, so the weighted mean lands on
 * 0–10 and is scaled by 10. A criterion the model failed to return contributes 0
 * — but that case is already rejected by `evaluationResultSchemaFor`, so in
 * practice this only runs over complete results.
 */
export function computeOverallScore(
  rubric: Rubric,
  results: CriterionResult[],
): number {
  const byKey = new Map(results.map((r) => [r.key, r.score]));

  const weighted = rubric.criteria.reduce((sum, criterion) => {
    return sum + (byKey.get(criterion.key) ?? 0) * criterion.weight;
  }, 0);

  return Math.round(weighted * 10 * 100) / 100; // 0–100, two decimals
}
