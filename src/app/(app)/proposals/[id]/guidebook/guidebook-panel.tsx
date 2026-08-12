import { AlertCircle, CheckCircle2, FileSearch, Info, ScrollText } from "lucide-react";
import { CompileProgress } from "@/app/(app)/proposals/[id]/guidebook/compile-progress";
import { RetryCompile } from "@/app/(app)/proposals/[id]/guidebook/retry-compile";
import { RubricEditor } from "@/app/(app)/proposals/[id]/guidebook/rubric-editor";
import { RubricSelector } from "@/app/(app)/proposals/[id]/guidebook/rubric-selector";
import { UploadGuidebook } from "@/app/(app)/proposals/[id]/guidebook/upload-guidebook";
import type { ProposalGuidebook } from "@/lib/guidebooks";
import type { RubricChoice } from "@/lib/proposals";

/**
 * The guidebook and rubric for one competition.
 *
 * Sits above the version timeline because it governs everything below it. A
 * guidebook can be uploaded at any point, including after versions have been
 * scored — teams routinely draft before the guidebook is published.
 *
 * Switching rubrics mid-competition does make scores less comparable, but that is
 * surfaced rather than prevented: `evaluations.rubric_id` records what each score
 * was measured against, so the panel can say plainly when versions were judged
 * differently instead of quietly presenting them as equivalent.
 */
export function GuidebookPanel({
  proposalId,
  teamId,
  guidebook,
  rubricId,
  rubricName,
  rubricIsDefault,
  rubricChoices,
  scoredRubrics,
}: {
  proposalId: string;
  teamId: string;
  guidebook: ProposalGuidebook | null;
  rubricId: string;
  rubricName: string;
  rubricIsDefault: boolean;
  rubricChoices: RubricChoice[];
  scoredRubrics: RubricChoice[];
}) {
  // Versions were judged by more than one yardstick, or by a rubric that is no
  // longer the active one. Either way the numbers below are not like-for-like.
  const mixedScoring =
    scoredRubrics.length > 1 ||
    (scoredRubrics.length === 1 && scoredRubrics[0].id !== rubricId);

  const mixedNote = mixedScoring ? (
    <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <Info className="mt-0.5 size-4 shrink-0" />
      <span>
        {scoredRubrics.length > 1
          ? `Versions below were scored against different rubrics (${scoredRubrics
              .map((r) => r.name)
              .join(", ")}). Compare those scores with care — they were not measured the same way.`
          : `Versions below were scored against ${scoredRubrics[0].name}. New versions will use ${rubricName}, so their scores will not be directly comparable.`}
      </span>
    </p>
  ) : null;

  // No guidebook yet.
  if (!guidebook) {
    return (
      <section className="card p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-100">
            <ScrollText className="size-5 text-accent" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="font-bold text-primary">Judging criteria</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">
              Scoring against{" "}
              <span className="font-semibold text-secondary">{rubricName}</span>
              {rubricIsDefault ? " — Champio's built-in rubric." : "."}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Upload this competition&rsquo;s guidebook and Champio will read out
              its actual criteria and weights, so every version is judged the way
              the real judges will judge it. You can do this at any point.
            </p>

            <div className="mt-4">
              <UploadGuidebook proposalId={proposalId} teamId={teamId} />
            </div>

            <RubricSelector
              proposalId={proposalId}
              choices={rubricChoices}
              activeRubricId={rubricId}
            />

            {mixedNote}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-100">
            <FileSearch className="size-5 text-accent" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold text-primary">Judging criteria</h2>
              {guidebook.savedRubricId ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="size-3" />
                  Compiled
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm text-ink-muted">
              {guidebook.fileName ?? "guidebook.pdf"}
            </p>

            {guidebook.status === "failed" ? (
              <>
                <p className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{guidebook.error ?? "Compilation failed."}</span>
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  If the guidebook is a scan rather than a text PDF, the criteria
                  cannot be read from it. Export a text-based PDF and try again.
                </p>
                <div className="mt-4">
                  <RetryCompile guidebookId={guidebook.id} />
                </div>
              </>
            ) : null}

            {guidebook.draftError ? (
              <>
                <p className="mt-3 flex items-start gap-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    The compiled draft did not satisfy the rubric contract:{" "}
                    {guidebook.draftError}
                  </span>
                </p>
                <div className="mt-4">
                  <RetryCompile guidebookId={guidebook.id} />
                </div>
              </>
            ) : null}

            {/* Once both exist, the team picks which one applies. */}
            <RubricSelector
              proposalId={proposalId}
              choices={rubricChoices}
              activeRubricId={rubricId}
            />

            {mixedNote}
          </div>
        </div>
      </div>

      {guidebook.status === "uploaded" || guidebook.status === "compiling" ? (
        <CompileProgress
          guidebookId={guidebook.id}
          initialStatus={guidebook.status}
        />
      ) : null}

      {/* Review-and-correct, before the rubric governs anything. */}
      {guidebook.draft && !guidebook.savedRubricId ? (
        <>
          <div className="rounded-[16px] bg-violet-100/60 p-5">
            <h3 className="font-bold text-primary">Check this before saving</h3>
            <p className="mt-1 text-sm leading-relaxed text-secondary-dark">
              These criteria were read out of your guidebook by a language model.
              It gets weights and labels right most of the time, but this rubric
              becomes the yardstick for every score this competition receives — so
              it is worth two minutes against the original document.
            </p>
          </div>

          <RubricEditor guidebookId={guidebook.id} draft={guidebook.draft} />
        </>
      ) : null}
    </section>
  );
}
