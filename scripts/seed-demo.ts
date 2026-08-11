/**
 * Demo fixture: a team, a proposal, two versions, and two completed evaluations
 * whose scores and issue lists differ — so the Phase 3 delta view has something
 * real to render the moment it is built, and so the report screen in Phase 2 can
 * be developed without burning LLM calls.
 *
 *   npm run seed:demo
 *
 * Idempotent: re-running deletes the previous demo team and rebuilds it.
 * Writes through the service role, which is the only way to insert evaluations —
 * they have no client INSERT policy.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import {
  computeOverallScore,
  evaluationResultSchemaFor,
  type CriterionResult,
} from "../src/lib/schemas/evaluation";
import { parseRubric } from "../src/lib/schemas/rubric";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = "demo@champio.test";
const DEMO_PASSWORD = "champio-demo-pw-1";
const DEMO_TEAM = "Delta Consulting (Demo)";
const PROMPT_VERSION = "seed-demo/v1";

async function main() {
  // ---------------------------------------------------------------- reset
  const { data: existingTeams } = await admin
    .from("teams")
    .select("id")
    .eq("name", DEMO_TEAM);

  for (const team of existingTeams ?? []) {
    await admin.from("teams").delete().eq("id", team.id);
  }

  // ----------------------------------------------------------------- user
  const { data: userList } = await admin.auth.admin.listUsers();
  let userId = userList?.users.find((u) => u.email === DEMO_EMAIL)?.id;

  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo Founder" },
    });
    if (error || !created.user) throw new Error(`createUser: ${error?.message}`);
    userId = created.user.id;
  }

  // ----------------------------------------------------------------- team
  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({ name: DEMO_TEAM, university: "Universitas Indonesia" })
    .select("id")
    .single();
  if (teamError || !team) throw new Error(`team: ${teamError?.message}`);

  const { error: memberError } = await admin
    .from("team_members")
    .insert({ team_id: team.id, user_id: userId, role: "owner" });
  if (memberError) throw new Error(`membership: ${memberError.message}`);

  // -------------------------------------------------- track + default rubric
  const { data: track } = await admin
    .from("tracks")
    .select("id")
    .eq("slug", "business_case")
    .single();
  if (!track) throw new Error("business_case track missing — run migration 0004");

  const { data: rubricRow } = await admin
    .from("rubrics")
    .select("id, schema_json")
    .eq("track_id", track.id)
    .eq("source", "default")
    .single();
  if (!rubricRow) throw new Error("default rubric missing — run migration 0004");

  // Parsing here is not ceremony: it proves the seeded rubric actually satisfies
  // the same contract the pipeline will enforce, including the weight sum.
  const rubric = parseRubric(rubricRow.schema_json);
  const resultSchema = evaluationResultSchemaFor(rubric);

  // ------------------------------------------------------------- proposal
  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .insert({
      team_id: team.id,
      track_id: track.id,
      rubric_id: rubricRow.id,
      title: "Reviving Warung Retail — ISAC 2026",
      created_by: userId,
    })
    .select("id")
    .single();
  if (proposalError || !proposal) throw new Error(`proposal: ${proposalError?.message}`);

  // v1 scores, and the v2 improvements. Written as a delta so the intent of the
  // fixture — "these three issues got resolved" — is legible in the source.
  const V1_SCORES: Record<string, number> = {
    problem_solution_fit: 6,
    analytical_rigor: 5,
    feasibility_impact: 7,
    financial_viability: 5,
    structure_clarity: 6,
    delivery_design: 7,
  };
  const V2_SCORES: Record<string, number> = {
    problem_solution_fit: 8,
    analytical_rigor: 8,
    feasibility_impact: 7,
    financial_viability: 7,
    structure_clarity: 8,
    delivery_design: 8,
  };

  const V1_ISSUES: Record<string, string[]> = {
    problem_solution_fit: [
      "Root cause is asserted on slide 3 but never evidenced.",
      "Two alternatives are listed and neither is rejected with a reason.",
    ],
    analytical_rigor: [
      "Market sizing on slide 5 gives no assumptions.",
      "The issue tree overlaps between branches 2 and 3 (not MECE).",
    ],
    feasibility_impact: ["No implementation timeline."],
    financial_viability: [
      "Revenue projection on slide 9 does not reconcile with the sizing on slide 5.",
    ],
    structure_clarity: ["Slide titles are topic labels rather than action titles."],
    delivery_design: ["Slide 7 carries 180 words of body text."],
  };

  // v2 resolves the first issue of each criterion — that is what the delta view
  // surfaces as "resolved issues".
  const V2_ISSUES: Record<string, string[]> = Object.fromEntries(
    Object.entries(V1_ISSUES).map(([key, issues]) => [key, issues.slice(1)]),
  );

  function buildResult(
    scores: Record<string, number>,
    issues: Record<string, string[]>,
    versionLabel: string,
  ) {
    const criteriaResults: CriterionResult[] = rubric.criteria.map((criterion) => ({
      key: criterion.key,
      score: scores[criterion.key] ?? 5,
      evidence: [`${versionLabel}: see slide ${1 + (criterion.key.length % 12)}`],
      strengths: [`${criterion.label} is addressed explicitly.`],
      issues: issues[criterion.key] ?? [],
      fixes: (issues[criterion.key] ?? []).map((issue, index) => ({
        priority: index + 1,
        action: `Resolve: ${issue}`,
        where: `slide ${3 + index}`,
      })),
    }));

    const overall = computeOverallScore(rubric, criteriaResults);

    // Validate the fixture against the same schema the pipeline uses. If this
    // throws, the seed is wrong — better to find out here than in the report UI.
    return resultSchema.parse({
      overall_score: overall,
      criteria_results: criteriaResults,
      format_compliance: [
        { rule: "max_slides", pass: true, note: "14 of 15 slides used." },
        { rule: "language", pass: true, note: "" },
      ],
      summary:
        versionLabel === "v1"
          ? "Solid instinct for the problem, but the analysis does not yet earn the recommendation. Fix the sizing assumptions and the storyline first."
          : "Substantially stronger. Sizing is now traceable and the storyline reads as an argument. Remaining gaps are in financial reconciliation.",
    });
  }

  const versions = [
    { number: 1, result: buildResult(V1_SCORES, V1_ISSUES, "v1") },
    { number: 2, result: buildResult(V2_SCORES, V2_ISSUES, "v2") },
  ];

  for (const { number, result } of versions) {
    const { data: version, error: versionError } = await admin
      .from("proposal_versions")
      .insert({
        proposal_id: proposal.id,
        team_id: team.id,
        version_number: number,
        file_path: `${team.id}/${proposal.id}/v${number}.pdf`,
        file_type: "pdf",
        extracted_text: `[page 1]\nDemo submission v${number}.\n[page 2]\nPlaceholder extracted text.`,
        extracted_meta: { page_count: 14, slide_count: 14 },
        created_by: userId,
      })
      .select("id")
      .single();
    if (versionError || !version) throw new Error(`version ${number}: ${versionError?.message}`);

    const startedAt = new Date(Date.now() - (3 - number) * 86_400_000);
    const completedAt = new Date(startedAt.getTime() + 42_000);

    const { error: evaluationError } = await admin.from("evaluations").insert({
      proposal_version_id: version.id,
      team_id: team.id,
      rubric_id: rubricRow.id,
      status: "complete",
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      overall_score: result.overall_score,
      result_json: result,
      token_input: 18_400 + number * 1_200,
      token_output: 2_300 + number * 150,
      cost_usd: 0.0214 + number * 0.0018,
      prompt_version: PROMPT_VERSION,
      attempt_count: 1,
    });
    if (evaluationError) throw new Error(`evaluation ${number}: ${evaluationError.message}`);

    await admin.from("events").insert([
      {
        event_name: "version_uploaded",
        user_id: userId,
        team_id: team.id,
        properties_json: { version_number: number },
      },
      {
        event_name: "evaluation_completed",
        user_id: userId,
        team_id: team.id,
        properties_json: {
          version_number: number,
          overall_score: result.overall_score,
        },
      },
    ]);

    console.log(`  v${number} → ${result.overall_score.toFixed(1)}/100`);
  }

  const lift = versions[1].result.overall_score - versions[0].result.overall_score;

  console.log(`
Demo seeded.
  team      ${DEMO_TEAM}
  sign in   ${DEMO_EMAIL} / ${DEMO_PASSWORD}
  proposal  Reviving Warung Retail — ISAC 2026
  lift      +${lift.toFixed(1)} points v1 → v2
`);
}

main().catch((error: unknown) => {
  console.error("\nSeed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
