import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { EvaluationProgress } from "@/app/(app)/proposals/[id]/evaluation-progress";
import { GuidebookPanel } from "@/app/(app)/proposals/[id]/guidebook/guidebook-panel";
import { RetryButton } from "@/app/(app)/proposals/[id]/retry-button";
import { UploadVersion } from "@/app/(app)/proposals/[id]/upload-version";
import { ScoreBadge } from "@/components/report/score-badge";
import { EVALUATIONS_PER_PROPOSAL_PER_DAY } from "@/lib/env";
import { getProposalGuidebook } from "@/lib/guidebooks";
import { isEvaluationLimitExempt } from "@/lib/limits";
import { getActiveTeam } from "@/lib/teams";
import { RenameProposal } from "@/app/(app)/proposals/[id]/rename-proposal";
import { VersionActions } from "@/app/(app)/proposals/[id]/version-actions";
import {
  getProposal,
  listProposalRubrics,
  listRubricChoices,
} from "@/lib/proposals";

export const metadata: Metadata = { title: "Competition" };

/**
 * One competition entry: its guidebook and rubric, then its versions.
 *
 * Server Actions invoked from this segment queue an evaluation or a guidebook
 * compilation and run it in `after()`. That post-response work counts against the
 * function's execution budget, and Vercel defaults Node functions to 10s — well
 * under the ~40s a real document takes end to end. 60s is the Hobby ceiling.
 */
export const maxDuration = 60;

export default async function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const { id } = await params;

  const proposal = await getProposal(id);
  // Covers both "no such proposal" and "not your team" — RLS filtered it either
  // way, and the client learns nothing extra from the distinction.
  if (!proposal) notFound();

  const [guidebook, rubricChoices, rubricDetails, limitExempt, team] =
    await Promise.all([
      getProposalGuidebook(proposal.id),
      listRubricChoices(proposal.trackId),
      listProposalRubrics(proposal.id, proposal.rubricId),
      isEvaluationLimitExempt(),
      getActiveTeam(),
    ]);

  // Mirrors the DELETE policy on proposal_versions, which is is_team_owner.
  const canDeleteVersions = team?.role === "owner";

  const evaluatedCount = proposal.versions.filter(
    (v) => v.evaluation?.status === "complete",
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/proposals"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Competitions
      </Link>

      <header className="mb-8">
        <RenameProposal proposalId={proposal.id} title={proposal.title} />
        <p className="mt-2 text-sm text-ink-muted">
          {proposal.trackName} · {proposal.versions.length} version
          {proposal.versions.length === 1 ? "" : "s"}
        </p>
      </header>

      {/* The rubric governs everything below it, so it comes first. */}
      <div className="mb-10">
        <GuidebookPanel
          proposalId={proposal.id}
          teamId={proposal.teamId}
          guidebook={guidebook}
          rubricId={proposal.rubricId}
          rubricName={proposal.rubricName}
          rubricIsDefault={proposal.rubricIsDefault}
          rubricChoices={rubricChoices}
          scoredRubrics={proposal.scoredRubrics}
          rubricDetails={rubricDetails}
        />
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-primary">Versions</h2>
          {evaluatedCount >= 2 ? (
            <Link
              href={`/proposals/${proposal.id}/delta`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
            >
              Compare versions
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
        </div>

        <div className="mb-6">
          <UploadVersion proposalId={proposal.id} teamId={proposal.teamId} />
        </div>

        {proposal.versions.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            Your first draft will be read page by page and scored against{" "}
            <span className="font-semibold text-secondary">
              {proposal.rubricName}
            </span>{" "}
            — usually under a minute.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {proposal.versions.map((version) => {
              const evaluation = version.evaluation;
              const isDone = evaluation?.status === "complete";
              const isFailed = evaluation?.status === "failed";

              return (
                <li key={version.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                      v{version.versionNumber}
                    </span>
                    {version.label ? (
                      <span className="min-w-0 truncate text-sm font-semibold text-primary">
                        {version.label}
                      </span>
                    ) : null}
                    <span className="text-xs text-ink-muted">
                      {new Date(version.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                      {evaluation && !isDone && !isFailed ? (
                        <EvaluationProgress
                          evaluationId={evaluation.id}
                          initialStatus={evaluation.status}
                        />
                      ) : null}
                      {isDone && evaluation.reused ? (
                        <span
                          title="This document was identical to an earlier version, so the earlier score was kept rather than the model being asked again."
                          className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-secondary"
                        >
                          Unchanged
                        </span>
                      ) : null}
                      {isDone ? <ScoreBadge score={evaluation.overallScore} /> : null}
                      <VersionActions
                        versionId={version.id}
                        versionNumber={version.versionNumber}
                        label={version.label}
                        canDelete={canDeleteVersions}
                      />
                    </div>
                  </div>

                  {isDone ? (
                    <Link
                      href={`/proposals/${proposal.id}/evaluations/${evaluation.id}`}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                    >
                      View report
                      <ArrowRight className="size-4" />
                    </Link>
                  ) : null}

                  {isFailed ? (
                    <div className="mt-4 flex flex-col gap-3">
                      <p className="flex items-start gap-2 rounded-[12px] bg-red-50 px-3 py-2 text-sm text-red-700">
                        <AlertCircle className="mt-0.5 size-4 shrink-0" />
                        <span>{evaluation.error ?? "The evaluation failed."}</span>
                      </p>
                      <div>
                        <RetryButton versionId={version.id} />
                      </div>
                    </div>
                  ) : null}

                  {!evaluation ? (
                    <div className="mt-4">
                      <RetryButton versionId={version.id} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-8 text-xs text-ink-muted">
          {limitExempt
            ? "No evaluation limit on this account."
            : `Limit: ${EVALUATIONS_PER_PROPOSAL_PER_DAY} evaluations per competition per 24 hours.`}
        </p>
      </section>
    </div>
  );
}
