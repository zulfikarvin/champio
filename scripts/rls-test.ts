/**
 * Adversarial RLS suite.
 *
 * The point of this file: every assertion runs through a **user-scoped anon
 * client**, holding a real signed-in user's JWT. Verifying isolation with the
 * service-role key proves nothing — that key bypasses RLS by design, which is the
 * classic way to "confirm" a policy that is in fact wide open.
 *
 * Shape: build two teams with two users, then have user A try everything it
 * should not be able to do to team B, plus the privilege-escalation moves that
 * would collapse the whole model.
 *
 *   npx tsx scripts/rls-test.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local. Creates and deletes its own users.
 */

import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON || !SERVICE) {
  console.error(
    "Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

type Client = SupabaseClient<Database>;

const admin: Client = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------- assertions

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push(name);
    console.log(`  \x1b[31m✗\x1b[0m ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** A read is "denied" when it errors OR returns zero rows: RLS filters silently
 *  on SELECT, so an empty result is the expected shape of a blocked read. */
function readDenied(result: { data: unknown[] | null; error: unknown }) {
  return Boolean(result.error) || (result.data?.length ?? 0) === 0;
}

/** A write is only denied if it actually errored. Silence is not denial. */
function writeDenied(result: { error: unknown }) {
  return Boolean(result.error);
}

// ------------------------------------------------------------------ fixtures

const stamp = Date.now();
const PASSWORD = "champio-rls-test-pw-1";

type Fixture = {
  userId: string;
  email: string;
  client: Client;
  teamId: string;
  proposalId: string;
  versionId: string;
  evaluationId: string;
  rubricId: string;
  guidebookId: string;
};

async function signedInClient(email: string): Promise<Client> {
  const client = createClient<Database>(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function buildFixture(label: string): Promise<Fixture> {
  const email = `rls-${label}-${stamp}@champio.test`;

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (userError || !created.user) {
    throw new Error(`createUser failed: ${userError?.message}`);
  }
  const userId = created.user.id;

  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({ name: `RLS ${label} ${stamp}` })
    .select("id")
    .single();
  if (teamError || !team) throw new Error(`team insert: ${teamError?.message}`);

  const { error: memberError } = await admin
    .from("team_members")
    .insert({ team_id: team.id, user_id: userId, role: "owner" });
  if (memberError) throw new Error(`membership insert: ${memberError.message}`);

  // Any seeded track + its default rubric; the suite does not care which.
  const { data: track } = await admin.from("tracks").select("id").limit(1).single();
  if (!track) throw new Error("no tracks seeded — run migration 0004 first");

  const { data: defaultRubric } = await admin
    .from("rubrics")
    .select("id")
    .is("team_id", null)
    .limit(1)
    .single();
  if (!defaultRubric) throw new Error("no default rubric — run migration 0004");

  // A team-scoped rubric, so cross-team rubric reads have something to fail on.
  const { data: teamRubric, error: rubricError } = await admin
    .from("rubrics")
    .insert({
      team_id: team.id,
      track_id: track.id,
      name: `RLS ${label} rubric`,
      source: "compiled_from_guidebook",
      schema_json: {
        rubric_name: `RLS ${label} rubric`,
        criteria: [
          {
            key: "only_criterion",
            label: "Only Criterion",
            weight: 1,
            description: "test",
            scoring_guide: { "1-10": "test" },
          },
        ],
        format_rules: { other: [] },
      },
    })
    .select("id")
    .single();
  if (rubricError || !teamRubric) {
    throw new Error(`rubric insert: ${rubricError?.message}`);
  }

  const { data: guidebook, error: guidebookError } = await admin
    .from("guidebooks")
    .insert({ team_id: team.id, file_path: `${team.id}/gb.pdf` })
    .select("id")
    .single();
  if (guidebookError || !guidebook) {
    throw new Error(`guidebook insert: ${guidebookError?.message}`);
  }

  const { data: proposal, error: proposalError } = await admin
    .from("proposals")
    .insert({
      team_id: team.id,
      track_id: track.id,
      rubric_id: defaultRubric.id,
      title: `RLS ${label} proposal`,
    })
    .select("id")
    .single();
  if (proposalError || !proposal) {
    throw new Error(`proposal insert: ${proposalError?.message}`);
  }

  const { data: version, error: versionError } = await admin
    .from("proposal_versions")
    .insert({
      proposal_id: proposal.id,
      team_id: team.id,
      version_number: 1,
      file_path: `${team.id}/${proposal.id}/v1.pdf`,
      file_type: "pdf",
    })
    .select("id")
    .single();
  if (versionError || !version) {
    throw new Error(`version insert: ${versionError?.message}`);
  }

  const { data: evaluation, error: evaluationError } = await admin
    .from("evaluations")
    .insert({
      proposal_version_id: version.id,
      team_id: team.id,
      rubric_id: defaultRubric.id,
      status: "complete",
      overall_score: 72,
    })
    .select("id")
    .single();
  if (evaluationError || !evaluation) {
    throw new Error(`evaluation insert: ${evaluationError?.message}`);
  }

  return {
    userId,
    email,
    client: await signedInClient(email),
    teamId: team.id,
    proposalId: proposal.id,
    versionId: version.id,
    evaluationId: evaluation.id,
    rubricId: teamRubric.id,
    guidebookId: guidebook.id,
  };
}

/**
 * Removes the fixtures.
 *
 * Errors are reported rather than swallowed. An earlier version ignored them,
 * which hid a real defect: guard_last_owner blocked the cascade from `teams`, so
 * every run silently leaked two teams, two users, their guidebooks and their
 * rubrics into the project. Migration 0007 fixed the trigger; checking the result
 * here is what stops the next such failure going unnoticed.
 */
async function teardown(fixtures: Fixture[]) {
  for (const f of fixtures) {
    const { error: teamError } = await admin.from("teams").delete().eq("id", f.teamId);
    if (teamError) {
      console.error(`  ! could not delete team ${f.teamId}: ${teamError.message}`);
    }

    const { error: userError } = await admin.auth.admin.deleteUser(f.userId);
    if (userError) {
      console.error(`  ! could not delete user ${f.email}: ${userError.message}`);
    }
  }

  // Prove it actually went, rather than assuming.
  for (const f of fixtures) {
    const { data: leftover } = await admin
      .from("teams")
      .select("id")
      .eq("id", f.teamId)
      .maybeSingle();
    if (leftover) console.error(`  ! team ${f.teamId} survived teardown`);
  }
}

// --------------------------------------------------------------------- suite

async function main() {
  console.log("\nBuilding fixtures…");
  const a = await buildFixture("a");
  const b = await buildFixture("b");

  try {
    console.log("\nSanity — team A can reach its OWN data");
    {
      const own = await a.client.from("proposals").select("id").eq("id", a.proposalId);
      check("A reads its own proposal", (own.data?.length ?? 0) === 1, own.error?.message);

      const ownEval = await a.client
        .from("evaluations")
        .select("id")
        .eq("id", a.evaluationId);
      check(
        "A reads its own evaluation",
        (ownEval.data?.length ?? 0) === 1,
        ownEval.error?.message,
      );
    }

    console.log("\nCross-team reads are denied");
    check(
      "A cannot read B's proposal",
      readDenied(await a.client.from("proposals").select("id").eq("id", b.proposalId)),
    );
    check(
      "A cannot read B's proposal version",
      readDenied(
        await a.client.from("proposal_versions").select("id").eq("id", b.versionId),
      ),
    );
    check(
      "A cannot read B's evaluation",
      readDenied(
        await a.client.from("evaluations").select("id").eq("id", b.evaluationId),
      ),
    );
    check(
      "A cannot read B's team rubric",
      readDenied(await a.client.from("rubrics").select("id").eq("id", b.rubricId)),
    );
    check(
      "A cannot read B's guidebook",
      readDenied(
        await a.client.from("guidebooks").select("id").eq("id", b.guidebookId),
      ),
    );
    check(
      "A cannot read B's team row",
      readDenied(await a.client.from("teams").select("id").eq("id", b.teamId)),
    );
    check(
      "A cannot read B's membership rows",
      readDenied(
        await a.client.from("team_members").select("user_id").eq("team_id", b.teamId),
      ),
    );

    console.log("\nDefault rubrics stay globally readable");
    {
      const defaults = await a.client.from("rubrics").select("id").is("team_id", null);
      check(
        "A can read the seeded default rubrics",
        (defaults.data?.length ?? 0) > 0,
        defaults.error?.message,
      );
    }

    console.log("\nCross-team writes are denied");
    {
      const { data: track } = await admin.from("tracks").select("id").limit(1).single();
      const { data: defaultRubric } = await admin
        .from("rubrics")
        .select("id")
        .is("team_id", null)
        .limit(1)
        .single();

      check(
        "A cannot create a proposal carrying B's team_id",
        writeDenied(
          await a.client.from("proposals").insert({
            team_id: b.teamId,
            track_id: track!.id,
            rubric_id: defaultRubric!.id,
            title: "hijack",
          }),
        ),
      );

      check(
        "A cannot add a version to B's proposal",
        writeDenied(
          await a.client.from("proposal_versions").insert({
            proposal_id: b.proposalId,
            team_id: a.teamId, // forged: the trigger replaces this with B's id
            version_number: 99,
            file_path: "x.pdf",
            file_type: "pdf",
          }),
        ),
      );

      check(
        "A cannot delete B's proposal",
        readDenied(
          await a.client
            .from("proposals")
            .delete()
            .eq("id", b.proposalId)
            .select("id"),
        ),
      );
    }

    console.log("\nteam_id cannot be forged on insert (inherit trigger)");
    {
      // A inserts into its OWN proposal but claims B's team_id. The insert should
      // succeed with A's team_id substituted — not be stored as B's.
      const forged = await a.client
        .from("proposal_versions")
        .insert({
          proposal_id: a.proposalId,
          team_id: b.teamId, // forged
          version_number: 2,
          file_path: `${a.teamId}/${a.proposalId}/v2.pdf`,
          file_type: "pdf",
        })
        .select("id, team_id")
        .single();

      check(
        "forged team_id is overwritten with the parent's",
        forged.data?.team_id === a.teamId,
        forged.error?.message ?? `got ${forged.data?.team_id}`,
      );
    }

    console.log("\nPrivilege escalation is blocked");
    check(
      "A cannot insert itself into B's team",
      writeDenied(
        await a.client
          .from("team_members")
          .insert({ team_id: b.teamId, user_id: a.userId, role: "owner" }),
      ),
    );
    check(
      "A cannot insert a membership even in its OWN team",
      writeDenied(
        await a.client
          .from("team_members")
          .insert({ team_id: a.teamId, user_id: b.userId, role: "member" }),
      ),
    );
    {
      const promote = await a.client
        .from("team_members")
        .update({ role: "owner" })
        .eq("team_id", a.teamId)
        .eq("user_id", a.userId)
        .select("user_id");
      check("A cannot UPDATE membership rows at all", readDenied(promote));
    }
    {
      const escalate = await a.client
        .from("profiles")
        .update({ is_admin: true })
        .eq("id", a.userId)
        .select("id");
      check(
        "A cannot set is_admin on its own profile",
        Boolean(escalate.error),
        "trigger should raise",
      );
    }

    console.log("\nServer-owned columns reject client writes");
    {
      const tamper = await a.client
        .from("evaluations")
        .update({ status: "complete", overall_score: 100, cost_usd: 0 })
        .eq("id", a.evaluationId)
        .select("id");
      check("A cannot update its own evaluation", readDenied(tamper));
    }
    {
      const insertEval = await a.client.from("evaluations").insert({
        proposal_version_id: a.versionId,
        team_id: a.teamId,
        rubric_id: a.rubricId,
        status: "complete",
        overall_score: 100,
      });
      check("A cannot insert an evaluation directly", writeDenied(insertEval));
    }
    {
      const forgeEvent = await a.client.from("events").insert({
        event_name: "evaluation_completed",
        user_id: a.userId,
        team_id: a.teamId,
      });
      check("A cannot write telemetry events", writeDenied(forgeEvent));
    }
    {
      const readEvents = await a.client.from("events").select("id").limit(1);
      check("A (non-admin) cannot read events", readDenied(readEvents));
    }
    {
      const attempt = await a.client.from("quiz_attempts").insert({
        user_id: a.userId,
        quiz_id: "00000000-0000-4000-8000-000000000000",
        score: 100,
        passed: true,
      });
      check("A cannot self-report a quiz score", writeDenied(attempt));
    }

    console.log("\nQuiz answer key is not column-readable");
    {
      const key = await a.client.from("quizzes").select("answer_key_json").limit(1);
      check(
        "A cannot select quizzes.answer_key_json",
        Boolean(key.error),
        "column privilege should be revoked",
      );

      const safe = await a.client.from("quizzes").select("id, questions_json").limit(1);
      check(
        "A can still select the client-safe quiz columns",
        !safe.error,
        safe.error?.message,
      );
    }

    console.log("\nStorage is team-prefixed");
    {
      // The Blob must carry its own MIME type. Passing only `contentType` leaves
      // the Blob as application/octet-stream, which the bucket's allowed_mime_types
      // rejects *before* any policy is consulted — that would make the denial
      // assertions below pass for the wrong reason.
      const pdfBlob = () =>
        new Blob([new Uint8Array([37, 80, 68, 70])], { type: "application/pdf" });

      /** A policy denial, as distinct from a MIME/size/not-found rejection. */
      const isAuthzError = (message: string | undefined) => {
        const m = (message ?? "").toLowerCase();
        return (
          m.includes("unauthorized") ||
          m.includes("violates row-level security") ||
          m.includes("permission")
        );
      };

      // Seed one object in B's prefix through the service role. If this fails,
      // every assertion below is meaningless, so it is checked rather than assumed.
      const objectPath = `${b.teamId}/${b.proposalId}/v1.pdf`;
      const seeded = await admin.storage
        .from("proposals")
        .upload(objectPath, pdfBlob(), {
          contentType: "application/pdf",
          upsert: true,
        });
      check(
        "fixture: B's file uploaded (precondition)",
        !seeded.error,
        seeded.error?.message,
      );

      const download = await a.client.storage.from("proposals").download(objectPath);
      check(
        "A cannot download from B's storage prefix",
        Boolean(download.error),
        download.error?.message,
      );

      const upload = await a.client.storage
        .from("proposals")
        .upload(`${b.teamId}/intrusion.pdf`, pdfBlob(), {
          contentType: "application/pdf",
        });
      check(
        "A cannot upload into B's storage prefix (denied by policy)",
        isAuthzError(upload.error?.message),
        upload.error?.message ?? "upload unexpectedly succeeded",
      );

      // The positive case. Without this, every assertion above would still pass
      // if the policies denied *everything* — including legitimate use.
      const ownUpload = await a.client.storage
        .from("proposals")
        .upload(`${a.teamId}/own.pdf`, pdfBlob(), {
          contentType: "application/pdf",
          upsert: true,
        });
      check(
        "A can upload into its own prefix",
        !ownUpload.error,
        ownUpload.error?.message,
      );

      const ownDownload = await a.client.storage
        .from("proposals")
        .download(`${a.teamId}/own.pdf`);
      check(
        "A can download from its own prefix",
        !ownDownload.error,
        ownDownload.error?.message,
      );

      await admin.storage
        .from("proposals")
        .remove([objectPath, `${a.teamId}/own.pdf`]);
    }

    console.log("\nRubric immutability once used");
    {
      // a.rubricId has no evaluations against it yet, so it should be editable.
      const editable = await a.client
        .from("rubrics")
        .update({ name: "renamed" })
        .eq("id", a.rubricId)
        .select("id");
      check(
        "an unused team rubric is editable",
        (editable.data?.length ?? 0) === 1,
        editable.error?.message,
      );

      // Point an evaluation at it, then try again.
      await admin
        .from("evaluations")
        .update({ rubric_id: a.rubricId })
        .eq("id", a.evaluationId);

      const frozen = await a.client
        .from("rubrics")
        .update({ name: "renamed again" })
        .eq("id", a.rubricId)
        .select("id");
      check("a used rubric is frozen", readDenied(frozen));
    }
  } finally {
    console.log("\nTearing down…");
    await teardown([a, b]);
  }

  const total = passed + failures.length;
  console.log(`\n${passed}/${total} assertions passed`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    process.exit(1);
  }
  console.log("RLS isolation holds.\n");
}

main().catch((error: unknown) => {
  console.error("\nSuite crashed:", error);
  process.exit(1);
});
