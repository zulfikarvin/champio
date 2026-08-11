import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { EvaluationProgress } from "@/app/(app)/proposals/[id]/evaluation-progress";
import { RetryButton } from "@/app/(app)/proposals/[id]/retry-button";
import { UploadVersion } from "@/app/(app)/proposals/[id]/upload-version";
import { ScoreBadge } from "@/components/report/score-badge";
import { EVALUATIONS_PER_PROPOSAL_PER_DAY } from "@/lib/env";
import { getProposal } from "@/lib/proposals";

export const metadata: Metadata = { title: "Proposal" };

/**
 * Server Actions invoked from this segment queue an evaluation and then run it in
 * `after()`. That post-response work counts against the function's execution
 * budget, and Vercel defaults Node functions to 10s — well under the ~40s a
 * 15-slide deck actually takes end to end (measured, see README ADR 8).
 *
 * 60s is the Hobby ceiling. Anything that still exceeds it is not lost: the row
 * stays in a non-terminal state and /api/cron/sweep re-drives it.
 */
export const maxDuration = 60;

export default async function ProposalPage({ params }: PageProps<"/proposals/[id]">) {
  const { id } = await params;
  const proposal = await getProposal(id);

  // Covers both "no such proposal" and "not your team" — RLS filtered it either
  // way, and the client learns nothing extra from the distinction.
  if (!proposal) notFound();

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
        Proposals
      </Link>

      <header className="mb-8">
        <h1 className="display-lg text-primary">{proposal.title}</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {proposal.trackName} · scored against{" "}
          <span className="font-semibold text-secondary">{proposal.rubricName}</span>
        </p>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <UploadVersion proposalId={proposal.id} teamId={proposal.teamId} />
        {evaluatedCount >= 2 ? (
          <Link href={`/proposals/${proposal.id}/delta`}>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
              Compare versions
              <ArrowRight className="size-4" />
            </span>
          </Link>
        ) : null}
      </div>

      {proposal.versions.length === 0 ? (
        <div className="card flex flex-col items-start gap-3 p-8">
          <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-violet-100">
            <FileText className="size-6 text-accent" />
          </span>
          <h2 className="text-lg font-bold text-primary">No versions yet</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Upload your draft as a PDF. We&rsquo;ll read it page by page and score
            it against the rubric — usually under a minute.
          </p>
        </div>
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
                    {isDone ? <ScoreBadge score={evaluation.overallScore} /> : null}
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
        Limit: {EVALUATIONS_PER_PROPOSAL_PER_DAY} evaluations per proposal per 24
        hours.
      </p>
    </div>
  );
}
