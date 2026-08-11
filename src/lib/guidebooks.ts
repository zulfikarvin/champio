import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { GuidebookStatus } from "@/lib/db";
import { rubricSchema, type Rubric } from "@/lib/schemas/rubric";

/** Reads for the Rubric Compiler. RLS scopes everything to the caller's teams. */

export type GuidebookSummary = {
  id: string;
  fileName: string | null;
  status: GuidebookStatus;
  error: string | null;
  createdAt: string;
  /** Set once the user has reviewed and saved the compiled draft. */
  savedRubricId: string | null;
  savedRubricName: string | null;
  /** True when a draft is waiting for review. */
  awaitingReview: boolean;
  criteriaCount: number | null;
};

export async function listGuidebooks(): Promise<GuidebookSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("guidebooks")
    .select("id, file_name, status, error, created_at, rubric_id, compiled_json, rubrics(name)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`failed to list guidebooks: ${error.message}`);

  return (data ?? []).map((row) => {
    // Parsed leniently for the list: a draft that fails validation should show as
    // needing attention, not crash the page listing every other guidebook.
    const parsed = row.compiled_json
      ? rubricSchema.safeParse(row.compiled_json)
      : null;

    return {
      id: row.id,
      fileName: row.file_name,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
      savedRubricId: row.rubric_id,
      savedRubricName: row.rubrics?.name ?? null,
      awaitingReview: row.status === "complete" && !row.rubric_id,
      criteriaCount: parsed?.success ? parsed.data.criteria.length : null,
    };
  });
}

export type GuidebookDetail = {
  id: string;
  teamId: string;
  fileName: string | null;
  status: GuidebookStatus;
  error: string | null;
  createdAt: string;
  savedRubricId: string | null;
  /** The compiled draft, if compilation finished and it validates. */
  draft: Rubric | null;
  /** Present when a draft exists but no longer satisfies the rubric contract. */
  draftError: string | null;
};

export async function getGuidebook(id: string): Promise<GuidebookDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("guidebooks")
    .select("id, team_id, file_name, status, error, created_at, rubric_id, compiled_json")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`failed to load guidebook: ${error.message}`);
  if (!data) return null; // absent, or RLS filtered it — same answer either way

  let draft: Rubric | null = null;
  let draftError: string | null = null;

  if (data.compiled_json) {
    const parsed = rubricSchema.safeParse(data.compiled_json);
    if (parsed.success) draft = parsed.data;
    else draftError = parsed.error.issues[0]?.message ?? "The draft is not valid.";
  }

  return {
    id: data.id,
    teamId: data.team_id,
    fileName: data.file_name,
    status: data.status,
    error: data.error,
    createdAt: data.created_at,
    savedRubricId: data.rubric_id,
    draft,
    draftError,
  };
}

/** Team-scoped rubrics, for the list screen. */
export async function listTeamRubrics() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rubrics")
    .select("id, name, created_at, schema_json, tracks(name)")
    .not("team_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`failed to list rubrics: ${error.message}`);

  return (data ?? []).map((row) => {
    const parsed = rubricSchema.safeParse(row.schema_json);
    return {
      id: row.id,
      name: row.name,
      trackName: row.tracks?.name ?? "—",
      createdAt: row.created_at,
      criteriaCount: parsed.success ? parsed.data.criteria.length : 0,
    };
  });
}
