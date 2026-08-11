/**
 * Full Rubric Compiler run against the live project and a real Gemini call.
 *
 *   npm run check:compiler -- <guidebook.pdf>
 *
 * Uploads a guidebook to the demo team, runs the compiler, prints what it
 * extracted, and cleans up. This is how you check extraction quality on a real
 * competition guidebook before pointing teams at it — the compiled rubric becomes
 * the yardstick for every score, so it is worth looking at directly.
 *
 * Spends real tokens: one evaluation-grade call per run.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { config } from "dotenv";

// The pipeline imports `server-only`, which throws outside a React server.
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
  if (!pdfPath) {
    console.error("Usage: npm run check:compiler -- <guidebook.pdf>");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { runCompilation } = await import("../src/lib/pipeline/compile-rubric");
  const { rubricSchema } = await import("../src/lib/schemas/rubric");
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

  const guidebookId = crypto.randomUUID();
  const filePath = `${team.id}/${guidebookId}.pdf`;
  const bytes = await readFile(pdfPath);

  const uploaded = await admin.storage
    .from("guidebooks")
    .upload(filePath, new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploaded.error) throw new Error(`upload: ${uploaded.error.message}`);

  await admin.from("guidebooks").insert({
    id: guidebookId,
    team_id: team.id,
    file_name: pdfPath.split(/[/\\]/).pop() ?? "guidebook.pdf",
    file_path: filePath,
    status: "uploaded",
  });

  console.log(`\nCompiling ${(bytes.length / 1024).toFixed(1)}KB guidebook…`);
  const startedAt = Date.now();
  await runCompilation(guidebookId);
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  const { data: done } = await admin
    .from("guidebooks")
    .select("status, error, compiled_json")
    .eq("id", guidebookId)
    .single();

  console.log(`Status: ${done!.status}   (${elapsed}s)\n`);

  if (done!.status !== "complete") {
    console.error(`FAILED: ${done!.error}\n`);
    await admin.from("guidebooks").delete().eq("id", guidebookId);
    await admin.storage.from("guidebooks").remove([filePath]);
    process.exit(1);
  }

  const rubric = rubricSchema.parse(done!.compiled_json);

  console.log(`Rubric: ${rubric.rubric_name}`);
  console.log(`Criteria: ${rubric.criteria.length}\n`);

  let weightSum = 0;
  for (const criterion of rubric.criteria) {
    weightSum += criterion.weight;
    const bands = Object.keys(criterion.scoring_guide).length;
    console.log(
      `  ${(criterion.weight * 100).toFixed(1).padStart(5)}%  ${criterion.label.padEnd(34).slice(0, 34)} ${bands} band(s)`,
    );
    console.log(`         key: ${criterion.key}`);
  }
  console.log(`\n  weights sum to ${(weightSum * 100).toFixed(2)}%  (normalised)`);

  console.log("\nFormat rules:");
  const fr = rubric.format_rules;
  if (fr.max_slides) console.log(`  max_slides  ${fr.max_slides}`);
  if (fr.max_pages) console.log(`  max_pages   ${fr.max_pages}`);
  if (fr.max_words) console.log(`  max_words   ${fr.max_words}`);
  if (fr.language) console.log(`  language    ${fr.language}`);
  for (const rule of fr.other) console.log(`  other       ${rule}`);
  if (!fr.max_slides && !fr.max_pages && !fr.max_words && !fr.language && fr.other.length === 0) {
    console.log("  (none extracted)");
  }

  console.log("\nSample scoring guide:");
  const sample = rubric.criteria[0];
  for (const [range, text] of Object.entries(sample.scoring_guide)) {
    console.log(`  ${sample.key} ${range}: ${text.slice(0, 78)}`);
  }

  await admin.from("guidebooks").delete().eq("id", guidebookId);
  await admin.storage.from("guidebooks").remove([filePath]);
  console.log("\nCleaned up.\n");
}

main().catch((error: unknown) => {
  console.error("\nCompiler check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
