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
  const { rubricStageSchema, rubricSchema } = await import("../src/lib/schemas/rubric");
  const { z } = await import("zod");
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

  const compiled = z
    .object({
      competition_name: z.string(),
      staged: z.array(
        z.object({
          stage: rubricStageSchema,
          sectionName: z.string(),
          rubric: rubricSchema,
        }),
      ),
    })
    .parse(done!.compiled_json);

  console.log(`Competition: ${compiled.competition_name}`);
  console.log(`Assessments found: ${compiled.staged.length}`);

  for (const section of compiled.staged) {
    console.log(`\n── ${section.stage.toUpperCase()} — "${section.sectionName}"`);

    let weightSum = 0;
    for (const criterion of section.rubric.criteria) {
      weightSum += criterion.weight;
      const bands = Object.keys(criterion.scoring_guide).length;
      console.log(
        `  ${(criterion.weight * 100).toFixed(1).padStart(5)}%  ${criterion.label
          .padEnd(42)
          .slice(0, 42)} ${bands} band(s)`,
      );
    }
    console.log(`         weights sum to ${(weightSum * 100).toFixed(2)}%`);

    const fr = section.rubric.format_rules;
    const rules: string[] = [];
    if (fr.max_slides) rules.push(`max_slides ${fr.max_slides}`);
    if (fr.max_pages) rules.push(`max_pages ${fr.max_pages}`);
    if (fr.max_words) rules.push(`max_words ${fr.max_words}`);
    if (fr.language) rules.push(`language ${fr.language}`);
    console.log(`         format: ${rules.length > 0 ? rules.join(", ") : "(none)"}`);
    for (const rule of fr.other) console.log(`                 · ${rule}`);
  }

  // The whole point of the split: nothing about delivery should reach the rubric
  // that scores a written document.
  const proposalSection = compiled.staged.find((s) => s.stage === "proposal");
  if (proposalSection) {
    const leaked = proposalSection.rubric.criteria.filter((c) =>
      /present|pitch|deliver|komunikasi|penampilan|menjawab|tanya/i.test(
        `${c.key} ${c.label}`,
      ),
    );
    console.log(
      `\nProposal rubric purity: ${
        leaked.length === 0
          ? "clean — no delivery criteria"
          : `LEAKED — ${leaked.map((c) => c.label).join(", ")}`
      }`,
    );
  } else {
    console.log(
      "\n! No proposal-stage section — uploads would fall back to another stage.",
    );
  }

  await admin.from("guidebooks").delete().eq("id", guidebookId);
  await admin.storage.from("guidebooks").remove([filePath]);
  console.log("\nCleaned up.\n");
}

main().catch((error: unknown) => {
  console.error("\nCompiler check failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
