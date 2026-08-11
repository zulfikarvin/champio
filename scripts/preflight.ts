/**
 * Checks that the local environment and the hosted Supabase project are actually
 * ready, and says precisely what to fix when they are not.
 *
 *   npm run preflight
 *
 * Exists because "it doesn't work" has about six possible causes here — missing
 * key, wrong key, migrations not applied, buckets missing, email confirmation on
 * — and guessing between them wastes more time than the check costs.
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const results: { ok: boolean; label: string; fix?: string }[] = [];

function record(ok: boolean, label: string, fix?: string) {
  results.push({ ok, label, fix });
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}`);
  if (!ok && fix) console.log(`      → ${fix}`);
}

async function main() {
  console.log("\nEnvironment");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const isPlaceholder = (v: string | undefined) =>
    !v || v.startsWith("PASTE_") || v.includes("placeholder");

  record(Boolean(url) && !isPlaceholder(url), "NEXT_PUBLIC_SUPABASE_URL set");
  record(
    !isPlaceholder(anon),
    "NEXT_PUBLIC_SUPABASE_ANON_KEY set",
    "Dashboard → Project Settings → API Keys → anon/publishable",
  );
  record(
    !isPlaceholder(service),
    "SUPABASE_SERVICE_ROLE_KEY set",
    "Dashboard → Project Settings → API Keys → service_role (Reveal)",
  );

  // Phase 2 onward: the evaluation pipeline cannot run without this.
  const gemini = process.env.GEMINI_API_KEY;
  record(
    Boolean(gemini) && !isPlaceholder(gemini) && gemini !== "not-needed-until-phase-2",
    "GEMINI_API_KEY set",
    "https://aistudio.google.com/apikey — required for evaluations",
  );

  // Optional: only the sweeper needs it, and only in a deployed environment.
  const cronSecret = process.env.CRON_SECRET;
  if (isPlaceholder(cronSecret) || !cronSecret) {
    console.log(
      "  \x1b[33m!\x1b[0m CRON_SECRET not set — /api/cron/sweep will refuse all requests",
    );
    console.log("      → Only needed once deployed; local runs use after() directly");
  } else {
    record(true, "CRON_SECRET set");
  }

  if (!url || isPlaceholder(anon) || isPlaceholder(service)) {
    console.log("\nFill in .env.local, then re-run.\n");
    process.exit(1);
  }

  const anonClient = createClient<Database>(url, anon!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient<Database>(url, service!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\nConnectivity");
  {
    const { error } = await admin.from("tracks").select("id").limit(1);
    const migrationsMissing =
      error?.message.includes("does not exist") ||
      error?.code === "42P01" ||
      error?.code === "PGRST205";

    if (migrationsMissing) {
      record(
        false,
        "migrations applied",
        "Paste supabase/migrations/0001→0004 into the SQL Editor, in order",
      );
      console.log("\nRun the migrations, then re-run this check.\n");
      process.exit(1);
    }
    record(!error, "service_role key works", error?.message);
  }
  {
    const { error } = await anonClient.from("tracks").select("id").limit(1);
    // An anon (signed-out) read of tracks is denied by policy — the policy is
    // `to authenticated`. An auth error here means a bad key; a permission
    // error means the key is fine and RLS is doing its job.
    const badKey =
      error?.message.toLowerCase().includes("api key") ||
      error?.message.toLowerCase().includes("jwt");
    record(!badKey, "anon key works", error?.message);
  }

  console.log("\nSchema");
  {
    const { count } = await admin
      .from("tracks")
      .select("id", { count: "exact", head: true });
    record(count === 3, `tracks seeded (${count ?? 0}/3)`, "Run migration 0004");
  }
  {
    const { count } = await admin
      .from("rubrics")
      .select("id", { count: "exact", head: true })
      .is("team_id", null);
    record(count === 3, `default rubrics seeded (${count ?? 0}/3)`, "Run migration 0004");
  }
  {
    const { error } = await admin.from("events").select("id").limit(1);
    record(!error, "events table present", error?.message);
  }

  console.log("\nRLS wiring");
  {
    // is_team_member must exist and be callable — every policy depends on it.
    const { error } = await admin.rpc("is_team_member", {
      t: "00000000-0000-4000-8000-000000000000",
    });
    record(!error, "is_team_member() helper present", error?.message ?? "Run migration 0002");
  }
  {
    // The answer key must be unreadable through the anon/authenticated role.
    // Checked via PostgREST as anon; a successful read here is a real leak.
    const { error } = await anonClient.from("quizzes").select("answer_key_json").limit(1);
    record(
      Boolean(error),
      "quiz answer key is not client-readable",
      "Re-run migration 0002 (column privilege section)",
    );
  }

  console.log("\nStorage");
  {
    const { data, error } = await admin.storage.listBuckets();
    const names = new Set((data ?? []).map((b) => b.name));
    for (const bucket of ["proposals", "guidebooks", "reference-papers"]) {
      record(names.has(bucket), `bucket "${bucket}"`, error?.message ?? "Run migration 0003");
    }
    const nonPrivate = (data ?? []).filter((b) => b.public).map((b) => b.name);
    record(
      nonPrivate.length === 0,
      "all buckets private",
      nonPrivate.length > 0 ? `public: ${nonPrivate.join(", ")}` : undefined,
    );
  }

  console.log("\nAuth");
  {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anon! },
    });
    const settings = (await response.json()) as {
      mailer_autoconfirm?: boolean;
      external?: Record<string, boolean>;
    };
    const autoconfirm = settings.mailer_autoconfirm === true;
    console.log(
      `  ${autoconfirm ? "\x1b[32m✓\x1b[0m" : "\x1b[33m!\x1b[0m"} email confirmation ${
        autoconfirm ? "OFF — signup logs straight in" : "ON — signup needs an emailed link"
      }`,
    );
    if (!autoconfirm) {
      console.log(
        "      → For faster local testing: Dashboard → Authentication → Sign In / Providers → disable “Confirm email”",
      );
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed${
      failed.length === 0 ? " — ready to run `npm run dev`" : ""
    }\n`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("\nPreflight crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
