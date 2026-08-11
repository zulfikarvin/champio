/**
 * Full evaluation pipeline test against the real project and a real Gemini call.
 *
 *   npm run check:pipeline [path-to.pdf]
 *
 * Creates a throwaway proposal on the demo team, uploads a PDF, runs the pipeline
 * end to end, prints the resulting report, and cleans up after itself.
 *
 * This is the only way to see what the pipeline actually costs and how the model
 * actually scores before pointing real users at it. It spends real tokens — one
 * gemini-2.5-pro call per run.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { config } from "dotenv";

// See the note in check-extraction.ts: the pipeline modules import `server-only`,
// which throws outside a React server. Satisfy it before importing them.
const nodeRequire = createRequire(import.meta.url);
nodeRequire.cache[nodeRequire.resolve("server-only")] = {
  id: "server-only",
  filename: "server-only",
  loaded: true,
  exports: {},
} as unknown as NodeModule;

config({ path: ".env.local" });

const DEFAULT_PDF = process.argv[2];

async function main() {
  if (!DEFAULT_PDF) {
    console.error("Usage: npm run check:pipeline -- <file.pdf>");
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.startsWith("not-needed")) {
    console.error("GEMINI_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { runEvaluation } = await import("../src/lib/pipeline/evaluate");
  const { evaluationResultSchema } = await import("../src/lib/schemas/evaluation");
  type Database = import("../src/lib/database.types").Database;

  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: team } = await admin
    .from("teams")
    .select("id")
    .eq("name", "Delta Consulting (Demo)")
    .maybeSingle();
  if (!team) throw new Error("Demo team missing — run `npm run seed:demo` first.");

  const { data: track } = await admin
    .from("tracks")
    .select("id")
    .eq("slug", "business_case")
    .single();
  const { data: rubric } = await admin
    .from("rubrics")
    .select("id, name")
    .eq("track_id", track!.id)
    .eq("source", "default")
    .single();

  console.log(`\nRubric: ${rubric!.name}`);

  const { data: proposal } = await admin
    .from("proposals")
    .insert({
      team_id: team.id,
      track_id: track!.id,
      rubric_id: rubric!.id,
      title: `Pipeline check ${new Date().toISOString()}`,
    })
    .select("id")
    .single();

  const versionId = crypto.randomUUID();
  const filePath = `${team.id}/${proposal!.id}/${versionId}.pdf`;

  const bytes = await readFile(DEFAULT_PDF);
  const uploaded = await admin.storage
    .from("proposals")
    .upload(filePath, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploaded.error) throw new Error(`upload: ${uploaded.error.message}`);
  console.log(`Uploaded ${(bytes.length / 1024).toFixed(1)}KB to ${filePath}`);

  await admin.from("proposal_versions").insert({
    id: versionId,
    proposal_id: proposal!.id,
    team_id: team.id,
    version_number: 1,
    file_path: filePath,
    file_type: "pdf",
  });

  const { data: evaluation } = await admin
    .from("evaluations")
    .insert({
      proposal_version_id: versionId,
      team_id: team.id,
      rubric_id: rubric!.id,
      status: "queued",
    })
    .select("id")
    .single();

  console.log("\nRunning pipeline…");
  const startedAt = Date.now();
  await runEvaluation(evaluation!.id);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  const { data: done } = await admin
    .from("evaluations")
    .select(
      "status, overall_score, result_json, error, token_input, token_output, cost_usd, attempt_count, prompt_version",
    )
    .eq("id", evaluation!.id)
    .single();

  console.log(`\nStatus: ${done!.status}   (${elapsed}s)`);

  if (done!.status !== "complete") {
    console.error(`\nFAILED: ${done!.error}\n`);
    await admin.from("proposals").delete().eq("id", proposal!.id);
    await admin.storage.from("proposals").remove([filePath]);
    process.exit(1);
  }

  console.log(
    `Tokens: ${done!.token_input} in / ${done!.token_output} out   Cost: $${Number(done!.cost_usd).toFixed(4)}`,
  );
  console.log(`Attempts: ${done!.attempt_count}   Prompt: ${done!.prompt_version}`);

  const result = evaluationResultSchema.parse(done!.result_json);

  console.log(`\nOverall: ${result.overall_score.toFixed(1)}/100`);
  console.log(`\n"${result.summary}"\n`);

  console.log("Per criterion:");
  for (const criterion of result.criteria_results) {
    console.log(
      `  ${criterion.key.padEnd(26)} ${String(criterion.score).padStart(2)}/10  ` +
        `${criterion.issues.length} issue(s), ${criterion.fixes.length} fix(es), ${criterion.evidence.length} evidence`,
    );
  }

  console.log("\nFormat compliance:");
  for (const rule of result.format_compliance) {
    console.log(`  ${rule.pass ? "✓" : "✗"} ${rule.rule}  ${rule.note}`);
  }

  console.log("\nSample fix:");
  const sample = result.criteria_results.find((c) => c.fixes.length > 0);
  if (sample) {
    const fix = sample.fixes[0];
    console.log(`  [${sample.key}] priority ${fix.priority} @ ${fix.where}`);
    console.log(`  ${fix.action}`);
  }

  console.log("\nSample evidence (must cite the document):");
  const withEvidence = result.criteria_results.find((c) => c.evidence.length > 0);
  if (withEvidence) console.log(`  ${withEvidence.evidence[0]}`);

  // Clean up: cascade removes versions and evaluations with the proposal.
  await admin.from("proposals").delete().eq("id", proposal!.id);
  await admin.storage.from("proposals").remove([filePath]);
  console.log("\nCleaned up.\n");
}

main().catch((error: unknown) => {
  console.error("\nPipeline check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
