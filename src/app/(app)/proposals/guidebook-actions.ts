"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SaveRubricState, UploadState } from "@/app/(app)/proposals/form-state";
import { toJson } from "@/lib/db";
import { runCompilation } from "@/lib/pipeline/compile-rubric";
import { rubricSchema, rubricStageSchema } from "@/lib/schemas/rubric";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Guidebook actions, scoped to a proposal.
 *
 * A proposal is a competition entry: one guidebook, one rubric, many versions.
 * Uploading the guidebook and saving the rubric it compiles into both happen from
 * the proposal, because that is what the rubric governs.
 */

const attachSchema = z.object({
  proposalId: z.string().uuid(),
  guidebookId: z.string().uuid(),
  filePath: z.string().min(1),
  fileName: z.string().max(300).optional(),
});

/**
 * Records a guidebook the browser already uploaded to Storage, attaches it to the
 * proposal, and queues compilation.
 *
 * The file goes browser → Storage directly, so a large PDF never has to fit
 * inside a serverless request body and the bucket's team-prefix policy is what
 * authorises the write. This only records metadata.
 */
export async function attachGuidebookAction(input: {
  proposalId: string;
  guidebookId: string;
  filePath: string;
  fileName?: string;
}): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid upload details." };

  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, team_id")
    .eq("id", parsed.data.proposalId)
    .maybeSingle();

  if (!proposal) return { status: "error", message: "Proposal not found." };

  const { data: guidebook, error } = await supabase
    .from("guidebooks")
    .insert({
      id: parsed.data.guidebookId,
      proposal_id: proposal.id,
      team_id: proposal.team_id, // replaced by the inherit trigger
      uploaded_by: user.id,
      file_name: parsed.data.fileName ?? null,
      file_path: parsed.data.filePath,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !guidebook) {
    console.error("[guidebook] insert failed:", error?.message);
    return {
      status: "error",
      message:
        error?.code === "23505"
          ? "This competition already has a guidebook."
          : "Could not record the upload.",
    };
  }

  revalidatePath(`/proposals/${proposal.id}`);

  after(async () => {
    await runCompilation(guidebook.id);
  });

  return { status: "queued", guidebookId: guidebook.id };
}

/** Re-runs compilation after a failure. */
export async function recompileGuidebookAction(
  guidebookId: string,
): Promise<UploadState> {
  const supabase = await createClient();
  const { data: guidebook } = await supabase
    .from("guidebooks")
    .select("id, proposal_id, rubric_id")
    .eq("id", guidebookId)
    .maybeSingle();

  if (!guidebook) return { status: "error", message: "Guidebook not found." };
  if (guidebook.rubric_id) {
    return {
      status: "error",
      message: "This guidebook already has a saved rubric.",
    };
  }

  // Reset through the service role: `guidebooks` has no client UPDATE policy,
  // because status and compiled_json are pipeline-owned.
  const admin = createAdminClient();
  await admin
    .from("guidebooks")
    .update({ status: "uploaded", error: null, compiled_json: null })
    .eq("id", guidebookId);

  if (guidebook.proposal_id) revalidatePath(`/proposals/${guidebook.proposal_id}`);

  after(async () => {
    await runCompilation(guidebookId);
  });

  return { status: "queued", guidebookId };
}

/**
 * Saves a reviewed draft as this competition's rubric, and points the proposal at
 * it.
 *
 * Allowed even when versions have already been scored. A team often uploads a
 * draft before the guidebook lands, and refusing the switch would strand them on
 * a generic rubric for the rest of the competition.
 *
 * The comparability problem is real but is handled by recording rather than
 * forbidding: `evaluations.rubric_id` captures what each score was actually
 * measured against, so a report always names its own yardstick and the proposal
 * page flags when versions were judged differently. Existing scores are never
 * rewritten — the rubric they used is frozen the moment it scores something.
 */
const editedSectionsSchema = z
  .array(
    z.object({
      stage: rubricStageSchema,
      rubric: rubricSchema,
    }),
  )
  .min(1)
  .max(6);

export async function saveProposalRubricAction(
  guidebookId: string,
  editedSections: unknown,
): Promise<SaveRubricState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = editedSectionsSchema.safeParse(editedSections);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: "error",
      message: issue
        ? `${issue.path.join(".") || "rubric"}: ${issue.message}`
        : "The rubric is not valid.",
    };
  }

  const supabase = await createClient();

  const { data: guidebook } = await supabase
    .from("guidebooks")
    .select("id, team_id, proposal_id, rubric_id, proposals(track_id)")
    .eq("id", guidebookId)
    .maybeSingle();

  if (!guidebook) return { status: "error", message: "Guidebook not found." };
  if (guidebook.rubric_id) {
    return { status: "error", message: "This guidebook already has a saved rubric." };
  }
  if (!guidebook.proposal_id) {
    return { status: "error", message: "This guidebook is not attached to a proposal." };
  }

  const trackId = guidebook.proposals?.track_id;
  if (!trackId) return { status: "error", message: "Proposal track missing." };

  // One rubric row per assessment stage. Inserted together so a partial save
  // cannot leave a competition with a presentation rubric and no proposal one.
  const { data: inserted, error } = await supabase
    .from("rubrics")
    .insert(
      parsed.data.map((section) => ({
        team_id: guidebook.team_id,
        track_id: trackId,
        guidebook_id: guidebook.id,
        stage: section.stage,
        name: section.rubric.rubric_name,
        source: "compiled_from_guidebook" as const,
        schema_json: toJson(section.rubric),
      })),
    )
    .select("id, stage");

  if (error || !inserted || inserted.length === 0) {
    console.error("[guidebook] rubric insert failed:", error?.message);
    return { status: "error", message: "Could not save the rubric." };
  }

  // The proposal is the written document, so it is scored by the proposal-stage
  // rubric. Falling back to the first only matters for a guidebook that defines
  // no proposal assessment at all, which is rare but not worth failing over.
  const proposalRubric =
    inserted.find((r) => r.stage === "proposal") ?? inserted[0];

  const { error: proposalError } = await supabase
    .from("proposals")
    .update({ rubric_id: proposalRubric.id })
    .eq("id", guidebook.proposal_id);

  if (proposalError) {
    console.error("[guidebook] proposal rubric update failed:", proposalError.message);
    return { status: "error", message: "Saved the rubric but could not apply it." };
  }

  const admin = createAdminClient();
  await admin
    .from("guidebooks")
    .update({ rubric_id: proposalRubric.id })
    .eq("id", guidebookId);

  revalidatePath(`/proposals/${guidebook.proposal_id}`);
  return { status: "saved", rubricId: proposalRubric.id };
}

const switchSchema = z.object({
  proposalId: z.string().uuid(),
  rubricId: z.string().uuid(),
});

/**
 * Chooses which rubric future versions of this competition are scored against.
 *
 * Validated against the rubrics actually available for the proposal's track,
 * which RLS already narrows to built-in rubrics plus this team's own — so a
 * client cannot point its competition at another team's rubric by sending an id.
 *
 * Past scores are untouched. Each evaluation keeps the `rubric_id` it was
 * produced with, so switching changes what happens next rather than rewriting
 * what already happened.
 */
export async function setProposalRubricAction(input: {
  proposalId: string;
  rubricId: string;
}): Promise<SaveRubricState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = switchSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid selection." };

  const supabase = await createClient();

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, track_id")
    .eq("id", parsed.data.proposalId)
    .maybeSingle();

  if (!proposal) return { status: "error", message: "Competition not found." };

  const { data: rubric } = await supabase
    .from("rubrics")
    .select("id")
    .eq("id", parsed.data.rubricId)
    .eq("track_id", proposal.track_id)
    .maybeSingle();

  if (!rubric) {
    return {
      status: "error",
      message: "That rubric is not available for this competition format.",
    };
  }

  const { error } = await supabase
    .from("proposals")
    .update({ rubric_id: rubric.id })
    .eq("id", proposal.id);

  if (error) {
    console.error("[proposals] rubric switch failed:", error.message);
    return { status: "error", message: "Could not change the rubric." };
  }

  revalidatePath(`/proposals/${proposal.id}`);
  return { status: "saved", rubricId: rubric.id };
}
