import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GuidebookStatus } from "@/lib/db";
import {
  rubricSchema,
  rubricStageSchema,
  type Rubric,
  type RubricStage,
} from "@/lib/schemas/rubric";
import { z } from "zod";

/**
 * Guidebook reads.
 *
 * A guidebook belongs to a proposal (migration 0009) — a competition has one set
 * of judging criteria, and the rubric a version is scored against comes from that
 * competition's guidebook. RLS scopes everything to the caller's teams.
 *
 * A guidebook compiles into one rubric per assessment stage (migration 0010),
 * because a real guidebook scores the written proposal and the live presentation
 * in separate tables.
 */

/** The shape the compiler writes into `guidebooks.compiled_json`. */
const compiledDraftSchema = z.object({
  competition_name: z.string(),
  staged: z
    .array(
      z.object({
        stage: rubricStageSchema,
        sectionName: z.string(),
        rubric: rubricSchema,
      }),
    )
    .min(1),
});

export type DraftSection = {
  stage: RubricStage;
  sectionName: string;
  rubric: Rubric;
};

export type ProposalGuidebook = {
  id: string;
  fileName: string | null;
  status: GuidebookStatus;
  error: string | null;
  createdAt: string;
  /** Set once the user has reviewed the compiled draft and saved it. */
  savedRubricId: string | null;
  competitionName: string | null;
  /** One entry per assessment the guidebook defines, awaiting review. */
  sections: DraftSection[];
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

  let sections: DraftSection[] = [];
  let competitionName: string | null = null;
  let draftError: string | null = null;

  // Only read the draft while it is still a draft. Once `rubric_id` is set the
  // saved rubrics are the source of truth, and compiled_json is just the input
  // that produced them — parsing it then would surface a "draft is not valid"
  // warning about something the user already reviewed and moved past.
  if (data.compiled_json && !data.rubric_id) {
    const parsed = compiledDraftSchema.safeParse(data.compiled_json);
    if (parsed.success) {
      competitionName = parsed.data.competition_name;
      sections = parsed.data.staged;
    } else {
      draftError = parsed.error.issues[0]?.message ?? "The draft is not valid.";
    }
  }

  return {
    id: data.id,
    fileName: data.file_name,
    status: data.status,
    error: data.error,
    createdAt: data.created_at,
    savedRubricId: data.rubric_id,
    competitionName,
    sections,
    draftError,
  };
}
