import { NextResponse, type NextRequest } from "next/server";
import { runEvaluation } from "@/lib/pipeline/evaluate";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-drives evaluations stranded in a non-terminal state.
 *
 * `after()` runs the pipeline in the same function instance that served the
 * request. That is what makes the async design work without extra infrastructure,
 * but it also means a cold-start eviction, a deploy mid-run, or a hard timeout
 * leaves a row sitting in `extracting` with nobody coming back for it. This is
 * the thing that comes back for it.
 *
 * On Vercel Hobby, Cron is limited to one run per day, so this is intended to be
 * called from GitHub Actions on a few-minute schedule (see .github/workflows).
 *
 * Idempotent by design: runEvaluation() returns immediately if the row has since
 * reached a terminal state, so overlapping sweeps are harmless.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Hobby ceiling

/** Younger than this and a live `after()` run is probably still working on it. */
const STALE_AFTER_MINUTES = 5;

/** Bounded per sweep so one invocation cannot exceed maxDuration. */
const MAX_PER_SWEEP = 3;

/** Give up after this many tries rather than burn tokens on a poisoned job. */
const MAX_ATTEMPTS = 3;

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Refuse rather than run open. An unauthenticated endpoint that triggers LLM
  // calls is a way for a stranger to spend your money.
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const staleBefore = new Date(
    Date.now() - STALE_AFTER_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: stuck, error } = await admin
    .from("evaluations")
    .select("id, status, attempt_count, created_at")
    .in("status", ["queued", "extracting", "evaluating"])
    .lt("created_at", staleBefore)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_SWEEP);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const exhausted = (stuck ?? []).filter((e) => e.attempt_count >= MAX_ATTEMPTS);
  const retryable = (stuck ?? []).filter((e) => e.attempt_count < MAX_ATTEMPTS);

  // A job that has failed three times is not going to succeed on the fourth.
  // Mark it failed so the user sees an explanation instead of a permanent spinner.
  for (const evaluation of exhausted) {
    await admin
      .from("evaluations")
      .update({
        status: "failed",
        error: `Gave up after ${evaluation.attempt_count} attempts. Try running it again.`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluation.id);
  }

  // Sequential, not parallel: three concurrent Gemini calls in a 60s function is
  // how you get all three timing out instead of one succeeding.
  for (const evaluation of retryable) {
    await runEvaluation(evaluation.id);
  }

  return NextResponse.json({
    swept: retryable.length,
    abandoned: exhausted.length,
    checkedAt: new Date().toISOString(),
  });
}
