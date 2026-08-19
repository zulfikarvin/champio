import "server-only";

import { EVALUATIONS_PER_PROPOSAL_PER_DAY } from "@/lib/env";
import { isUserExemptFromLimit } from "@/lib/limits";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enqueueing an evaluation.
 *
 * This is the only code path that can create an `evaluations` row — the table has
 * no client INSERT policy — which is precisely what makes the rate limit
 * enforceable rather than advisory. A limit checked in a component is a
 * suggestion; a limit checked in the single write path is a limit.
 *
 * The same property is what makes the exemption safe: it is read here, server
 * side, from a column no client can write.
 */

export type EnqueueOutcome =
  | { ok: true; evaluationId: string }
  | { ok: false; reason: "rate_limited"; retryAfter: Date; used: number }
  | { ok: false; reason: "in_flight"; evaluationId: string }
  | { ok: false; reason: "error"; message: string };

export async function enqueueEvaluation({
  proposalVersionId,
  proposalId,
  teamId,
  rubricId,
  userId,
}: {
  proposalVersionId: string;
  proposalId: string;
  teamId: string;
  rubricId: string;
  /** Whose quota this run counts against. Exempt accounts skip the cap entirely. */
  userId: string;
}): Promise<EnqueueOutcome> {
  const admin = createAdminClient();

  // Don't stack a second run on a version already being processed. Cheap to
  // check, and it stops a double-click costing two Gemini calls.
  const { data: inFlight } = await admin
    .from("evaluations")
    .select("id")
    .eq("proposal_version_id", proposalVersionId)
    .in("status", ["queued", "extracting", "evaluating"])
    .limit(1)
    .maybeSingle();

  if (inFlight) {
    return { ok: false, reason: "in_flight", evaluationId: inFlight.id };
  }

  // The in-flight check above still applies to exempt accounts: it stops a
  // double-click costing two Gemini calls, which is a correctness guard rather
  // than a quota.
  if (await isUserExemptFromLimit(userId)) {
    return insertQueued({ proposalVersionId, teamId, rubricId });
  }

  // Rate limit is per proposal, not per version — otherwise uploading a new
  // version resets it and the limit means nothing.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: versionIds, error: versionError } = await admin
    .from("proposal_versions")
    .select("id")
    .eq("proposal_id", proposalId);

  if (versionError) {
    return { ok: false, reason: "error", message: versionError.message };
  }

  const { data: recent, error: recentError } = await admin
    .from("evaluations")
    .select("created_at")
    .in("proposal_version_id", (versionIds ?? []).map((v) => v.id))
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  if (recentError) {
    return { ok: false, reason: "error", message: recentError.message };
  }

  const used = recent?.length ?? 0;
  if (used >= EVALUATIONS_PER_PROPOSAL_PER_DAY) {
    // The window frees up when the oldest of the counted runs ages out.
    const oldest = new Date(recent![0].created_at);
    return {
      ok: false,
      reason: "rate_limited",
      retryAfter: new Date(oldest.getTime() + 24 * 60 * 60 * 1000),
      used,
    };
  }

  return insertQueued({ proposalVersionId, teamId, rubricId });
}

async function insertQueued({
  proposalVersionId,
  teamId,
  rubricId,
}: {
  proposalVersionId: string;
  teamId: string;
  rubricId: string;
}): Promise<EnqueueOutcome> {
  const admin = createAdminClient();

  const { data: created, error: insertError } = await admin
    .from("evaluations")
    .insert({
      proposal_version_id: proposalVersionId,
      team_id: teamId, // overwritten by the inherit trigger; sent for readability
      rubric_id: rubricId,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return {
      ok: false,
      reason: "error",
      message: insertError?.message ?? "could not queue the evaluation",
    };
  }

  return { ok: true, evaluationId: created.id };
}
