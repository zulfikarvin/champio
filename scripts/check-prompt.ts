/**
 * Evaluates a PDF against a rubric with a real Gemini call and NO database writes.
 *
 *   npm run check:prompt -- <file.pdf> [track-slug]
 *
 * This is the prompt-iteration loop. `check:pipeline` proves the plumbing;
 * this one is for looking at whether the *scores* are any good — whether the
 * calibration anchors are holding, whether evidence actually cites page markers,
 * and what a run costs — without leaving rows behind or burning rate limit.
 *
 * Reads the rubric from the database so it tests the rubric users actually get,
 * not a copy that can drift.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { config } from "dotenv";

// The pipeline modules import `server-only`, which throws outside a React server.
// Satisfy it before the dynamic imports below rather than weakening the guard.
const nodeRequire = createRequire(import.meta.url);
nodeRequire.cache[nodeRequire.resolve("server-only")] = {
  id: "server-only",
  filename: "server-only",
  loaded: true,
  exports: {},
} as unknown as NodeModule;

config({ path: ".env.local" });

async function main() {
  const pdfPath = process.argv[2];
  const trackSlug = process.argv[3] ?? "business_case";

  if (!pdfPath) {
    console.error("Usage: npm run check:prompt -- <file.pdf> [track-slug]");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { extractPdf } = await import("../src/lib/extraction/pdf");
  const { generateJson } = await import("../src/lib/ai/gemini");
  const { EVALUATION_MODEL, isPricingVerified } = await import("../src/lib/ai/pricing");
  const { buildEvaluationPrompt, EVALUATE_PROMPT_VERSION, EVALUATE_SYSTEM_INSTRUCTION } =
    await import("../src/lib/ai/prompts/evaluate");
  const { checkCountableRules, fuzzyRulesFor, mergeFormatCompliance } = await import(
    "../src/lib/pipeline/format-rules"
  );
  const { computeOverallScore, evaluationResultSchemaFor } = await import(
    "../src/lib/schemas/evaluation"
  );
  const { parseRubric } = await import("../src/lib/schemas/rubric");
  type Database = import("../src/lib/database.types").Database;

  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: track } = await admin
    .from("tracks")
    .select("id, name")
    .eq("slug", trackSlug)
    .single();
  if (!track) throw new Error(`No track "${trackSlug}"`);

  const { data: rubricRow } = await admin
    .from("rubrics")
    .select("name, schema_json")
    .eq("track_id", track.id)
    .eq("source", "default")
    .single();
  if (!rubricRow) throw new Error("No default rubric for that track");

  const rubric = parseRubric(rubricRow.schema_json);

  const bytes = await readFile(pdfPath);
  const { text, meta } = await extractPdf(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );

  console.log(`\nDocument   ${pdfPath}`);
  console.log(`           ${meta.page_count} pages, ${meta.word_count} words`);
  console.log(`Rubric     ${rubric.rubric_name} (${rubric.criteria.length} criteria)`);
  console.log(`Model      ${EVALUATION_MODEL}`);
  console.log(`Prompt     ${EVALUATE_PROMPT_VERSION}`);

  const fuzzyRules = fuzzyRulesFor(rubric.format_rules);
  const deterministic = checkCountableRules(rubric.format_rules, meta);

  console.log("\nCalling Gemini…");
  const startedAt = Date.now();

  const { data: result, usage, attempts, model } = await generateJson({
    model: EVALUATION_MODEL,
    systemInstruction: EVALUATE_SYSTEM_INSTRUCTION,
    prompt: buildEvaluationPrompt({ rubric, documentText: text, meta, fuzzyRules }),
    schema: evaluationResultSchemaFor(rubric),
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const overall = computeOverallScore(rubric, result.criteria_results);

  console.log(`\n${elapsed}s · ${attempts} attempt(s) · ${model}`);
  console.log(
    `Tokens: ${usage.inputTokens} in / ${usage.outputTokens} out · $${usage.costUsd.toFixed(4)}` +
      (isPricingVerified(model) ? "" : "  (estimated rate)"),
  );

  console.log(`\nOverall: ${overall.toFixed(1)}/100`);
  console.log(`Model claimed: ${result.overall_score} (discarded — we compute it)`);
  console.log(`\n"${result.summary}"\n`);

  console.log("Per criterion:");
  let citedCount = 0;
  for (const criterion of rubric.criteria) {
    const r = result.criteria_results.find((c) => c.key === criterion.key)!;
    const cites = r.evidence.filter((e) => /page\s*\d+/i.test(e)).length;
    citedCount += cites;
    console.log(
      `  ${criterion.label.padEnd(30).slice(0, 30)} ${String(r.score).padStart(2)}/10  ` +
        `w=${(criterion.weight * 100).toFixed(0)}%  ` +
        `${r.issues.length}i ${r.fixes.length}f ${r.evidence.length}e (${cites} cite a page)`,
    );
  }

  // Calibration sanity: the prompt anchors 5-6 as the honest centre. If every
  // score lands 7+, the anchors are not holding and the delta view loses signal.
  const scores = result.criteria_results.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  console.log(`\nSpread: ${min}–${max} across ${scores.length} criteria`);
  if (min >= 7) {
    console.log(
      "  ! Every criterion scored 7+. Either the document is genuinely strong, or\n" +
        "    the calibration anchors are not biting. Check against a weak document.",
    );
  }
  if (citedCount === 0) {
    console.log("  ! No evidence cited a page marker — locations will be unusable.");
  }

  console.log("\nFormat compliance:");
  for (const rule of mergeFormatCompliance(
    deterministic,
    result.format_compliance,
    fuzzyRules,
  )) {
    console.log(`  ${rule.pass ? "✓" : "✗"} ${rule.rule.padEnd(14)} ${rule.note}`);
  }

  const topFix = result.criteria_results
    .flatMap((c) => c.fixes.map((f) => ({ ...f, key: c.key })))
    .sort((a, b) => a.priority - b.priority)[0];

  if (topFix) {
    console.log(`\nTop fix [${topFix.key}] @ ${topFix.where}`);
    console.log(`  ${topFix.action}`);
  }

  const sampleEvidence = result.criteria_results.find((c) => c.evidence.length > 0);
  if (sampleEvidence) {
    console.log(`\nSample evidence [${sampleEvidence.key}]`);
    console.log(`  ${sampleEvidence.evidence[0]}`);
  }

  console.log("\nNo database rows written.\n");
}

main().catch((error: unknown) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
