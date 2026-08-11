"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type {
  CreateProposalState,
  EnqueueState,
} from "@/app/(app)/proposals/form-state";
import { logEvent } from "@/lib/events";
import { enqueueEvaluation } from "@/lib/pipeline/enqueue";
import { runEvaluation } from "@/lib/pipeline/evaluate";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveTeam } from "@/lib/teams";

const createProposalSchema = z.object({
  title: z.string().trim().min(3, "Give the proposal a title.").max(200),
  trackId: z.string().uuid("Pick a track."),
  rubricId: z.string().uuid("Pick a rubric."),
});

export async function createProposalAction(
  _prev: CreateProposalState,
  formData: FormData,
): Promise<CreateProposalState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const team = await getActiveTeam();
  if (!team) return { error: "Create a team first." };

  const parsed = createProposalSchema.safeParse({
    title: formData.get("title"),
    trackId: formData.get("trackId"),
    rubricId: formData.get("rubricId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }

  // Insert through the user-scoped client so RLS validates team membership
  // rather than us re-deriving it here.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      team_id: team.teamId,
      track_id: parsed.data.trackId,
      rubric_id: parsed.data.rubricId,
      title: parsed.data.title,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[proposals] create failed:", error?.message);
    return { error: "Could not create the proposal. Try again." };
  }

  await logEvent({
    name: "proposal_created",
    userId: user.id,
    teamId: team.teamId,
    properties: { proposal_id: data.id, track_id: parsed.data.trackId },
  });

  revalidatePath("/proposals");
  redirect(`/proposals/${data.id}`);
}

const recordVersionSchema = z.object({
  proposalId: z.string().uuid(),
  versionId: z.string().uuid(),
  filePath: z.string().min(1),
  fileName: z.string().max(300).optional(),
});

/**
 * Records a version whose file the browser has already uploaded to Storage, then
 * queues its evaluation.
 *
 * The file never passes through this server. It goes straight from the browser to
 * Supabase Storage, where the bucket policy enforces the team prefix — which
 * keeps us clear of Vercel's request body limit (well under a 25MB deck) and
 * removes a pointless hop. This action only writes metadata.
 */
export async function recordVersionAction(input: {
  proposalId: string;
  versionId: string;
  filePath: string;
  fileName?: string;
}): Promise<EnqueueState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = recordVersionSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Invalid upload details." };
  }

  const supabase = await createClient();

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id, team_id, rubric_id")
    .eq("id", parsed.data.proposalId)
    .maybeSingle();

  if (proposalError || !proposal) {
    return { status: "error", message: "Proposal not found." };
  }

  // Next version number. A unique (proposal_id, version_number) constraint means
  // a concurrent double-upload fails loudly here rather than creating two "v2"s.
  const { data: existing } = await supabase
    .from("proposal_versions")
    .select("version_number")
    .eq("proposal_id", proposal.id)
    .order("version_number", { ascending: false })
    .limit(1);

  const versionNumber = (existing?.[0]?.version_number ?? 0) + 1;

  const { data: version, error: versionError } = await supabase
    .from("proposal_versions")
    .insert({
      id: parsed.data.versionId,
      proposal_id: proposal.id,
      team_id: proposal.team_id, // replaced by the inherit trigger
      version_number: versionNumber,
      file_path: parsed.data.filePath,
      file_type: "pdf",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    console.error("[proposals] version insert failed:", versionError?.message);
    return {
      status: "error",
      message:
        versionError?.code === "23505"
          ? "Another upload just landed. Refresh and try again."
          : "Could not record the upload.",
    };
  }

  await logEvent({
    name: "version_uploaded",
    userId: user.id,
    teamId: proposal.team_id,
    properties: {
      proposal_id: proposal.id,
      version_id: version.id,
      version_number: versionNumber,
    },
  });

  const outcome = await enqueueEvaluation({
    proposalVersionId: version.id,
    proposalId: proposal.id,
    teamId: proposal.team_id,
    rubricId: proposal.rubric_id,
  });

  revalidatePath(`/proposals/${proposal.id}`);

  if (!outcome.ok) {
    if (outcome.reason === "rate_limited") {
      return {
        status: "error",
        message: `Daily limit reached (${outcome.used} evaluations in 24h). The version is saved — you can evaluate it after ${outcome.retryAfter.toLocaleTimeString()}.`,
      };
    }
    if (outcome.reason === "in_flight") {
      return { status: "queued", evaluationId: outcome.evaluationId };
    }
    return { status: "error", message: outcome.message };
  }

  // Respond now, process after. This is the whole async design on Hobby: no
  // request blocks on the LLM, and the client follows the row over Realtime.
  after(async () => {
    await runEvaluation(outcome.evaluationId);
  });

  return { status: "queued", evaluationId: outcome.evaluationId };
}

/** Re-runs evaluation for an existing version (after a failure, or a rubric change). */
export async function reevaluateAction(versionId: string): Promise<EnqueueState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const supabase = await createClient();
  const { data: version, error } = await supabase
    .from("proposal_versions")
    .select("id, proposal_id, team_id, proposals(rubric_id)")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !version) return { status: "error", message: "Version not found." };

  const rubricId = version.proposals?.rubric_id;
  if (!rubricId) return { status: "error", message: "Proposal rubric missing." };

  const outcome = await enqueueEvaluation({
    proposalVersionId: version.id,
    proposalId: version.proposal_id,
    teamId: version.team_id,
    rubricId,
  });

  revalidatePath(`/proposals/${version.proposal_id}`);

  if (!outcome.ok) {
    if (outcome.reason === "rate_limited") {
      return {
        status: "error",
        message: `Daily limit reached (${outcome.used} in 24h). Try again after ${outcome.retryAfter.toLocaleTimeString()}.`,
      };
    }
    if (outcome.reason === "in_flight") {
      return { status: "queued", evaluationId: outcome.evaluationId };
    }
    return { status: "error", message: outcome.message };
  }

  after(async () => {
    await runEvaluation(outcome.evaluationId);
  });

  return { status: "queued", evaluationId: outcome.evaluationId };
}
