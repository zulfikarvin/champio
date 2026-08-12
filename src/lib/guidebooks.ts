import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GuidebookStatus } from "@/lib/db";
import { rubricSchema, type Rubric } from "@/lib/schemas/rubric";

/**
 * Guidebook reads.
 *
 * A guidebook belongs to a proposal (migration 0009) — a competition has one set
 * of judging criteria, and the rubric a version is scored against comes from that
 * competition's guidebook. RLS scopes everything to the caller's teams.
 */

export type ProposalGuidebook = {
  id: string;
  fileName: string | null;
  status: GuidebookStatus;
  error: string | null;
  createdAt: string;
  /** Set once the user has reviewed the compiled draft and saved it. */
  savedRubricId: string | null;
  /** The compiled draft, when compilation finished and it validates. */
  draft: Rubric | null;
  /** Present when a draft exists but no longer satisfies the rubric contract. */
  draftError: string | null;
};

/** The single guidebook attached to a proposal, if there is one. */
export async function getProposalGuidebook(
  proposalId: string,
): Promise<ProposalGuidebook | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("guidebooks")
    .select("id, file_name, status, error, created_at, rubric_id, compiled_json")
    .eq("proposal_id", proposalId)
    .maybeSingle();

  if (error) throw new Error(`failed to load guidebook: ${error.message}`);
  if (!data) return null;

  let draft: Rubric | null = null;
  let draftError: string | null = null;

  if (data.compiled_json) {
    const parsed = rubricSchema.safeParse(data.compiled_json);
    if (parsed.success) draft = parsed.data;
    else draftError = parsed.error.issues[0]?.message ?? "The draft is not valid.";
  }

  return {
    id: data.id,
    fileName: data.file_name,
    status: data.status,
    error: data.error,
    createdAt: data.created_at,
    savedRubricId: data.rubric_id,
    draft,
    draftError,
  };
}

/** Looks up which proposal a guidebook belongs to, for redirects after an action. */
export async function getGuidebookProposalId(
  guidebookId: string,
): Promise<string | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("guidebooks")
    .select("proposal_id")
    .eq("id", guidebookId)
    .maybeSingle();

  return data?.proposal_id ?? null;
}
