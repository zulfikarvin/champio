import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Loader2,
  ScrollText,
} from "lucide-react";
import { UploadGuidebook } from "@/app/(app)/rubrics/upload-guidebook";
import { listGuidebooks, listTeamRubrics } from "@/lib/guidebooks";
import { getActiveTeam } from "@/lib/teams";

export const metadata: Metadata = { title: "Rubrics" };

/** Compilation runs in after(); give it the ceiling the plan allows. */
export const maxDuration = 60;

export default async function RubricsPage() {
  const team = await getActiveTeam();
  if (!team) redirect("/dashboard");

  const [guidebooks, rubrics] = await Promise.all([
    listGuidebooks(),
    listTeamRubrics(),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-lg text-primary">Rubrics</h1>
          <p className="mt-1 max-w-lg text-sm text-ink-muted">
            Upload your competition&rsquo;s guidebook and Champio compiles its
            judging criteria into a rubric. Review it, then score your proposals
            against the criteria your judges actually use.
          </p>
        </div>
        <UploadGuidebook teamId={team.teamId} />
      </header>

      {guidebooks.length === 0 && rubrics.length === 0 ? (
        <div className="card flex flex-col items-start gap-4 p-8">
          <span className="inline-flex size-12 items-center justify-center rounded-[16px] bg-violet-100">
            <ScrollText className="size-6 text-accent" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-primary">
              No custom rubrics yet
            </h2>
            <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-muted">
              Every proposal is scored against a rubric. The three built-in ones
              are a good default, but a compiled rubric matches your specific
              competition&rsquo;s criteria and weights.
            </p>
          </div>
          <UploadGuidebook teamId={team.teamId} />
        </div>
      ) : null}

      {guidebooks.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Guidebooks
          </h2>
          <ul className="flex flex-col gap-3">
            {guidebooks.map((guidebook) => (
              <li key={guidebook.id}>
                <Link
                  href={`/rubrics/${guidebook.id}`}
                  className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
                >
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-violet-100">
                    <FileSearch className="size-4.5 text-accent" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-primary">
                      {guidebook.fileName ?? "Guidebook"}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {new Date(guidebook.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {guidebook.criteriaCount !== null
                        ? ` · ${guidebook.criteriaCount} criteria`
                        : ""}
                    </p>

                    {guidebook.status === "failed" && guidebook.error ? (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        <span className="min-w-0">{guidebook.error}</span>
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0">
                    {guidebook.savedRubricId ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="size-3.5" />
                        Saved
                      </span>
                    ) : guidebook.awaitingReview ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                        Review
                        <ArrowRight className="size-3.5" />
                      </span>
                    ) : guidebook.status === "failed" ? (
                      <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">
                        Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-secondary">
                        <Loader2 className="size-3.5 animate-spin" />
                        {guidebook.status === "compiling" ? "Reading" : "Queued"}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rubrics.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Your rubrics
          </h2>
          <ul className="flex flex-col gap-3">
            {rubrics.map((rubric) => (
              <li key={rubric.id} className="card flex items-center gap-4 p-5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-violet-100">
                  <ScrollText className="size-4.5 text-accent" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-primary">
                    {rubric.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {rubric.criteriaCount} criteria · available when you create a
                    proposal
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-muted">
            A rubric is frozen once an evaluation has used it — otherwise a v1
            and v2 score would be measured against different yardsticks.
          </p>
        </section>
      ) : null}
    </div>
  );
}
