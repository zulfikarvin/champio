/**
 * Verifies that the rubrics seeded by migration 0004 satisfy the same contract
 * the evaluation pipeline enforces at runtime.
 *
 *   npm run verify:rubrics
 *
 * Reads the SQL directly and needs no database, so it can run in CI. It exists
 * because the seed data and the Zod schema are two independent expressions of
 * the same contract, and nothing else would notice them drifting apart — a
 * rubric whose weights no longer sum to 1.0 would quietly rescale every score
 * the product reports.
 *
 * Checks, per rubric:
 *   - parses against rubricSchema (weights sum to 1.0, keys are snake_case, …)
 *   - a perfect 10 on every criterion computes to exactly 100
 *   - a result missing a criterion is rejected by evaluationResultSchemaFor
 */

import { readFileSync } from "node:fs";
import {
  computeOverallScore,
  evaluationResultSchemaFor,
  type CriterionResult,
} from "../src/lib/schemas/evaluation";
import { parseRubric } from "../src/lib/schemas/rubric";

const SEED_FILE = "supabase/migrations/0004_seed_content.sql";

/** Pulls every `'{...}'::jsonb` literal out of the seed migration. */
function extractJsonbLiterals(sql: string): string[] {
  const literals: string[] = [];
  const pattern = /'(\{[\s\S]*?\})'::jsonb/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) {
    // Postgres escapes a literal quote by doubling it.
    literals.push(match[1].replace(/''/g, "'"));
  }
  return literals;
}

function main() {
  const sql = readFileSync(SEED_FILE, "utf8");
  const literals = extractJsonbLiterals(sql);

  if (literals.length === 0) {
    console.error(`No jsonb literals found in ${SEED_FILE}`);
    process.exit(1);
  }

  const failures: string[] = [];

  for (const literal of literals) {
    let name = "<unparsed>";
    try {
      const rubric = parseRubric(JSON.parse(literal));
      name = rubric.rubric_name;

      const schema = evaluationResultSchemaFor(rubric);
      const perfect: CriterionResult[] = rubric.criteria.map((c) => ({
        key: c.key,
        score: 10,
        evidence: ["evidence"],
        strengths: ["strength"],
        issues: [],
        fixes: [],
      }));

      const top = computeOverallScore(rubric, perfect);
      if (top !== 100) {
        failures.push(`${name}: perfect scores compute to ${top}, expected 100`);
        continue;
      }

      schema.parse({
        overall_score: top,
        criteria_results: perfect,
        format_compliance: [],
        summary: "ok",
      });

      // The 1:1 criterion mapping must actually be enforced, not just declared.
      const incomplete = schema.safeParse({
        overall_score: 50,
        criteria_results: perfect.slice(1),
        format_compliance: [],
        summary: "ok",
      });
      if (incomplete.success) {
        failures.push(`${name}: a result missing a criterion was accepted`);
        continue;
      }

      const weightSum = rubric.criteria.reduce((s, c) => s + c.weight, 0);
      console.log(
        `  ✓ ${name} — ${rubric.criteria.length} criteria, weights ${weightSum.toFixed(4)}`,
      );
    } catch (error) {
      failures.push(
        `${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(`\n${literals.length - failures.length}/${literals.length} rubrics valid`);

  if (failures.length > 0) {
    console.error("\nFailures:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

main();
