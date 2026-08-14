import { z } from "zod";

/**
 * The rubric contract.
 *
 * This schema is the single gate through which *every* rubric passes — the three
 * seeded defaults and anything the Phase 4 guidebook compiler produces. Because
 * both go through here, the evaluation pipeline can treat a rubric compiled from
 * a PDF five minutes ago exactly like one we wrote by hand.
 *
 * If evaluation code ever branches on `source`, that abstraction has been broken.
 */

/**
 * Score bands, keyed by range label ("1-3", "4-6", ...). Kept as an open record
 * rather than a fixed set of four keys: a real competition guidebook may define
 * three bands or five, and forcing our banding onto it would mean discarding
 * information from the source document.
 */
export const scoringGuideSchema = z.record(z.string(), z.string().min(1));

export const criterionSchema = z.object({
  /** Stable identifier. Joins criteria to results, and v1 results to v2 results
   *  in the delta view — so it must be machine-shaped, not prose. */
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "criterion key must be lower_snake_case (it is used as a join key)",
    ),
  label: z.string().min(1).max(120),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  scoring_guide: scoringGuideSchema,
});

export const formatRulesSchema = z.object({
  max_slides: z.number().int().positive().optional(),
  max_pages: z.number().int().positive().optional(),
  max_words: z.number().int().positive().optional(),
  language: z.enum(["id", "en"]).optional(),
  other: z.array(z.string().min(1)).default([]),
});

/** Weights are allowed to drift by this much from 1.0 before we reject them —
 *  enough to absorb decimal representation, not enough to hide a real mistake. */
const WEIGHT_TOLERANCE = 0.01;

export const rubricSchema = z
  .object({
    rubric_name: z.string().min(1).max(200),
    criteria: z.array(criterionSchema).min(1).max(20),
    format_rules: formatRulesSchema.default({ other: [] }),
  })
  .superRefine((rubric, ctx) => {
    // Duplicate keys would silently collapse results in the delta view.
    const keys = rubric.criteria.map((c) => c.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message: `duplicate criterion keys: ${[...new Set(duplicates)].join(", ")}`,
      });
    }

    // Weights must be a distribution. The overall score is a weighted mean, and
    // weights summing to 0.8 or 1.3 would quietly rescale every score we report.
    const total = rubric.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(total - 1) > WEIGHT_TOLERANCE) {
      ctx.addIssue({
        code: "custom",
        path: ["criteria"],
        message: `criterion weights must sum to 1.0 (got ${total.toFixed(3)})`,
      });
    }
  });

export type Criterion = z.infer<typeof criterionSchema>;
export type FormatRules = z.infer<typeof formatRulesSchema>;
export type Rubric = z.infer<typeof rubricSchema>;

/**
 * Which assessment a rubric scores.
 *
 * A guidebook usually defines several: the written proposal is judged on content,
 * the pitch on delivery. Merging them produces criteria that cannot apply — a
 * document scored on "Penampilan dan Komunikasi" — and halves every real weight.
 */
export const RUBRIC_STAGES = [
  "proposal",
  "presentation",
  "prototype",
  "other",
] as const;

export const rubricStageSchema = z.enum(RUBRIC_STAGES);
export type RubricStage = z.infer<typeof rubricStageSchema>;

export const STAGE_LABELS: Record<RubricStage, string> = {
  proposal: "Proposal",
  presentation: "Presentation",
  prototype: "Prototype",
  other: "Other",
};

/**
 * One assessment table as the compiler read it, before normalisation.
 *
 * Deliberately looser than `rubricSchema` on one field: `weight` accepts any
 * positive number rather than requiring a 0–1 distribution summing to 1.0.
 *
 * Real guidebooks state weights as percentages — "Kreativitas 30%" — and
 * frequently they do not add up, because a document written for humans rounds.
 * Demanding a normalised distribution from the model would fail validation on the
 * common case and burn a retry to fix arithmetic we can do ourselves.
 */
export const compiledSectionSchema = z.object({
  stage: rubricStageSchema,
  /** The heading as the guidebook writes it, e.g. "Penilaian Proposal". */
  section_name: z.string().min(1).max(200),
  criteria: z
    .array(
      criterionSchema.extend({
        weight: z
          .number()
          .positive("weight must be greater than zero")
          .max(1000, "weight looks like a total, not a per-criterion value"),
      }),
    )
    .min(1)
    .max(20),
  format_rules: formatRulesSchema.default({ other: [] }),
});

/**
 * The whole compiler output: a competition, and one section per assessment the
 * guidebook defines.
 */
export const compiledGuidebookSchema = z
  .object({
    competition_name: z.string().min(1).max(200),
    sections: z.array(compiledSectionSchema).min(1).max(6),
  })
  .superRefine((compiled, ctx) => {
    // Two tables scoring the same stage would leave it ambiguous which one
    // applies to a version, and the database rejects it anyway.
    const stages = compiled.sections.map((s) => s.stage);
    const duplicates = stages.filter((s, i) => stages.indexOf(s) !== i);
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sections"],
        message: `more than one section for stage: ${[...new Set(duplicates)].join(", ")}`,
      });
    }
  });

export type CompiledSection = z.infer<typeof compiledSectionSchema>;
export type CompiledGuidebook = z.infer<typeof compiledGuidebookSchema>;

/** A section turned into a valid rubric, with its stage carried alongside. */
export type StagedRubric = {
  stage: RubricStage;
  sectionName: string;
  rubric: Rubric;
};

/**
 * Turns one compiled section into a valid rubric: rescales the weights to a
 * distribution, then validates against the real contract.
 *
 * Rescaling happens per section, which is the point of splitting them. Merged,
 * eight criteria across two 100% tables would each be halved; separately, each
 * table keeps the weights the guidebook actually states.
 *
 * Throws if the result still fails — a problem rescaling cannot fix, such as
 * duplicate criterion keys.
 */
export function finaliseSection(
  section: CompiledSection,
  competitionName: string,
): StagedRubric {
  const rubric = rubricSchema.parse({
    rubric_name: `${competitionName} — ${STAGE_LABELS[section.stage]}`,
    criteria: normaliseWeights(section.criteria),
    format_rules: section.format_rules,
  });

  return { stage: section.stage, sectionName: section.section_name, rubric };
}

export function finaliseCompiled(compiled: CompiledGuidebook): StagedRubric[] {
  return compiled.sections.map((section) =>
    finaliseSection(section, compiled.competition_name),
  );
}

/**
 * Normalises weights to sum to exactly 1.0, preserving proportions.
 *
 * The compiler will routinely extract weights from a guidebook that reads
 * "30% / 30% / 25% / 10%" and does not add up. Rather than reject the document,
 * we rescale and show the user what we did in the preview screen.
 */
export function normaliseWeights(criteria: Criterion[]): Criterion[] {
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) {
    // No usable signal — fall back to an equal split rather than dividing by zero.
    const equal = 1 / criteria.length;
    return criteria.map((c) => ({ ...c, weight: equal }));
  }
  return criteria.map((c) => ({ ...c, weight: c.weight / total }));
}

/** Parses a `rubrics.schema_json` value from the database. */
export function parseRubric(value: unknown): Rubric {
  return rubricSchema.parse(value);
}
