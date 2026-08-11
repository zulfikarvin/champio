import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { CriterionCard } from "@/components/report/criterion-card";
import { ScoreRing } from "@/components/report/score-ring";
import { createClient } from "@/lib/supabase/server";
import { evaluationResultSchema } from "@/lib/schemas/evaluation";
import { parseRubric } from "@/lib/schemas/rubric";

export const metadata: Metadata = { title: "Evaluation report" };

export default async function EvaluationReportPage({
  params,
}: PageProps<"/proposals/[id]/evaluations/[evaluationId]">) {
  const { id, evaluationId } = await params;
  const supabase = await createClient();

  const { data: evaluation } = await supabase
    .from("evaluations")
    .select(
      `id, status, overall_score, result_json, completed_at, prompt_version,
       rubrics(name, schema_json),
       proposal_versions(version_number, proposal_id, extracted_meta)`,
    )
    .eq("id", evaluationId)
    .maybeSingle();

  if (!evaluation || evaluation.proposal_versions?.proposal_id !== id) notFound();

  if (evaluation.status !== "complete" || !evaluation.result_json) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href={`/proposals/${id}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-accent"
        >
          <ArrowLeft className="size-4" />
          Back to proposal
        </Link>
        <div className="card p-8">
          <h1 className="text-lg font-bold text-primary">Report not ready</h1>
          <p className="mt-2 text-sm text-ink-muted">
            This evaluation is {evaluation.status}. The report appears once it
            completes.
          </p>
        </div>
      </div>
    );
  }

  // Both are parsed rather than cast. A result written by an older prompt version
  // whose shape has since changed should surface as a clear failure here, not as
  // a component crashing on an undefined field halfway down the page.
  const rubric = parseRubric(evaluation.rubrics?.schema_json);
  const result = evaluationResultSchema.parse(evaluation.result_json);

  const byKey = new Map(result.criteria_results.map((r) => [r.key, r]));
  const versionNumber = evaluation.proposal_versions?.version_number ?? 1;

  const totalFixes = result.criteria_results.reduce(
    (sum, r) => sum + r.fixes.length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href={`/proposals/${id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Back to proposal
      </Link>

      <header className="mb-6">
        <p className="text-sm font-semibold text-accent">Version {versionNumber}</p>
        <h1 className="display-lg mt-1 text-primary">Evaluation report</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Scored against {evaluation.rubrics?.name}
          {evaluation.completed_at
            ? ` · ${new Date(evaluation.completed_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`
            : ""}
        </p>
      </header>

      <section className="card mb-6 p-6">
        <ScoreRing score={Number(evaluation.overall_score ?? 0)} />
        <p className="mt-5 border-t border-hairline pt-5 text-sm leading-relaxed text-ink">
          {result.summary}
        </p>
        {totalFixes > 0 ? (
          <p className="mt-3 text-xs font-semibold text-ink-muted">
            {totalFixes} specific fix{totalFixes === 1 ? "" : "es"} suggested below.
          </p>
        ) : null}
      </section>

      {result.format_compliance.length > 0 ? (
        <section className="card mb-6 p-5">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Format compliance
          </h2>
          <ul className="flex flex-col gap-2">
            {result.format_compliance.map((rule) => (
              <li key={rule.rule} className="flex items-start gap-2 text-sm">
                {rule.pass ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-red-600" />
                )}
                <span className="min-w-0">
                  <span className="font-semibold text-ink">
                    {rule.rule.replace(/_/g, " ")}
                  </span>
                  {rule.note ? (
                    <span className="text-ink-muted"> — {rule.note}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Criterion order follows the rubric, not the model's output order, so two
          reports for the same rubric always read top-to-bottom the same way. */}
      <section className="flex flex-col gap-4">
        {rubric.criteria.map((criterion) => {
          const result = byKey.get(criterion.key);
          if (!result) return null;
          return (
            <CriterionCard
              key={criterion.key}
              criterion={criterion}
              result={result}
            />
          );
        })}
      </section>

      {evaluation.prompt_version ? (
        <p className="mt-8 text-center text-[11px] text-ink-muted">
          Generated with prompt {evaluation.prompt_version}
        </p>
      ) : null}
    </div>
  );
}
