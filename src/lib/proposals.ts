import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { EvaluationStatus, SubmissionFileType } from "@/lib/db";

/**
 * Typed reads for proposals and their versions.
 *
 * All of these go through the user-scoped client, so RLS does the tenant
 * filtering. None of them take a team id as an argument on purpose — a helper
 * that accepts `teamId` invites a call site that passes the wrong one.
 */

export type ProposalSummary = {
  id: string;
  title: string;
  createdAt: string;
  trackName: string;
  rubricName: string;
  /** True while still on a built-in rubric — no guidebook applied yet. */
  rubricIsDefault: boolean;
  versionCount: number;
  latestScore: number | null;
};

export async function listProposals(): Promise<ProposalSummary[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("proposals")
    .select(
      `id, title, created_at,
       tracks(name),
       rubrics(name, source),
       proposal_versions(id, version_number, evaluations(overall_score, status, created_at))`,
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(`failed to list proposals: ${error.message}`);

  return (data ?? []).map((row) => {
    const versions = row.proposal_versions ?? [];

    // Latest *completed* score, by highest version number — a queued run on v3
    // should not blank out the score the team already has from v2.
    const scored = versions
      .flatMap((v) =>
        (v.evaluations ?? [])
          .filter((e) => e.status === "complete" && e.overall_score !== null)
          .map((e) => ({ version: v.version_number, score: Number(e.overall_score) })),
      )
      .sort((a, b) => b.version - a.version);

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      trackName: row.tracks?.name ?? "—",
      rubricName: row.rubrics?.name ?? "—",
      rubricIsDefault: row.rubrics?.source === "default",
      versionCount: versions.length,
      latestScore: scored[0]?.score ?? null,
    };
  });
}

export type VersionWithEvaluation = {
  id: string;
  versionNumber: number;
  filePath: string;
  fileType: SubmissionFileType;
  createdAt: string;
  evaluation: {
    id: string;
    status: EvaluationStatus;
    overallScore: number | null;
    error: string | null;
    createdAt: string;
  } | null;
};

export type RubricChoice = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type ProposalDetail = {
  id: string;
  title: string;
  teamId: string;
  trackId: string;
  trackName: string;
  rubricId: string;
  rubricName: string;
  /** True while still on a built-in rubric — i.e. no guidebook rubric applied. */
  rubricIsDefault: boolean;
  createdAt: string;
  versions: VersionWithEvaluation[];
  /**
   * Rubrics that have actually scored a version of this competition.
   *
   * The rubric a proposal points at can change; `evaluations.rubric_id` records
   * what each score was measured against, so this is the honest history. More
   * than one entry means the versions below were not all judged the same way,
   * which the UI has to say out loud rather than quietly compare.
   */
  scoredRubrics: RubricChoice[];
};

export async function getProposal(id: string): Promise<ProposalDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("proposals")
    .select(
      `id, title, team_id, track_id, created_at, rubric_id,
       tracks(name),
       rubrics(name, source),
       proposal_versions(
         id, version_number, file_path, file_type, created_at,
         evaluations(id, status, overall_score, error, created_at, rubric_id, rubrics(name, source))
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`failed to load proposal: ${error.message}`);
  if (!data) return null; // not found, or RLS filtered it — same answer to the client

  const versions: VersionWithEvaluation[] = (data.proposal_versions ?? [])
    .map((version) => {
      // Newest evaluation wins: a re-run supersedes the previous attempt.
      const latest = [...(version.evaluations ?? [])].sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      )[0];

      return {
        id: version.id,
        versionNumber: version.version_number,
        filePath: version.file_path,
        fileType: version.file_type,
        createdAt: version.created_at,
        evaluation: latest
          ? {
              id: latest.id,
              status: latest.status,
              overallScore:
                latest.overall_score === null ? null : Number(latest.overall_score),
              error: latest.error,
              createdAt: latest.created_at,
            }
          : null,
      };
    })
    .sort((a, b) => b.versionNumber - a.versionNumber);

  // Distinct rubrics behind completed scores, in first-seen order.
  const scoredRubrics: RubricChoice[] = [];
  for (const version of data.proposal_versions ?? []) {
    for (const evaluation of version.evaluations ?? []) {
      if (evaluation.status !== "complete") continue;
      if (scoredRubrics.some((r) => r.id === evaluation.rubric_id)) continue;
      scoredRubrics.push({
        id: evaluation.rubric_id,
        name: evaluation.rubrics?.name ?? "—",
        isDefault: evaluation.rubrics?.source === "default",
      });
    }
  }

  return {
    id: data.id,
    title: data.title,
    teamId: data.team_id,
    trackId: data.track_id,
    trackName: data.tracks?.name ?? "—",
    rubricId: data.rubric_id,
    rubricName: data.rubrics?.name ?? "—",
    rubricIsDefault: data.rubrics?.source === "default",
    createdAt: data.created_at,
    versions,
    scoredRubrics,
  };
}

/**
 * The rubrics a competition can be scored against: its track's built-in rubric,
 * plus any rubric compiled from its own guidebook.
 */
export async function listRubricChoices(
  trackId: string,
): Promise<RubricChoice[]> {
  const supabase = await createClient();

  // RLS already limits this to default rubrics plus the caller's team's own.
  const { data, error } = await supabase
    .from("rubrics")
    .select("id, name, source")
    .eq("track_id", trackId)
    .order("source");

  if (error) throw new Error(`failed to load rubrics: ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isDefault: r.source === "default",
  }));
}

/**
 * Tracks with their built-in rubric — the choices on the "new competition" form.
 *
 * Only the default is returned. A competition's real rubric comes from its
 * guidebook, uploaded on the entry itself, so there is nothing to pick here.
 */
export async function listTracksWithRubrics() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tracks")
    .select("id, slug, name, rubrics(id, source)")
    .order("name");

  if (error) throw new Error(`failed to load tracks: ${error.message}`);

  return (data ?? []).map((track) => ({
    id: track.id,
    slug: track.slug,
    name: track.name,
    defaultRubricId:
      (track.rubrics ?? []).find((r) => r.source === "default")?.id ?? null,
  }));
}
