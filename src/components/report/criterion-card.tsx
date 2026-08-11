import { AlertTriangle, CheckCircle2, Quote, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CriterionResult } from "@/lib/schemas/evaluation";
import type { Criterion } from "@/lib/schemas/rubric";

/**
 * One criterion's result.
 *
 * Ordered issues-before-strengths on purpose: a team opening this screen is
 * looking for what to fix, and putting praise first buries the reason they came.
 * Fixes are last because they are the action items — the thing you scroll to and
 * work from.
 */
export function CriterionCard({
  criterion,
  result,
}: {
  criterion: Criterion;
  result: CriterionResult;
}) {
  const pct = (result.score / 10) * 100;

  return (
    <article className="card p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold text-primary">{criterion.label}</h3>
        <span className="text-xs font-semibold text-ink-muted">
          {(criterion.weight * 100).toFixed(0)}% weight
        </span>
      </header>

      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-canvas"
          role="img"
          aria-label={`${result.score} out of 10`}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all",
              result.score >= 7
                ? "bg-accent"
                : result.score >= 5
                  ? "bg-amber-400"
                  : "bg-red-400",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
          {result.score}
          <span className="text-xs font-semibold text-ink-muted">/10</span>
        </span>
      </div>

      {result.evidence.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {result.evidence.map((item, index) => (
            <li
              key={index}
              className="flex gap-2 rounded-[12px] bg-violet-100/60 px-3 py-2 text-sm text-secondary-dark"
            >
              <Quote className="mt-0.5 size-3.5 shrink-0 opacity-60" />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {result.issues.length > 0 ? (
        <section className="mt-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <AlertTriangle className="size-3.5 text-amber-500" />
            Issues
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.issues.map((issue, index) => (
              <li key={index} className="text-sm leading-relaxed text-ink">
                {issue}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.strengths.length > 0 ? (
        <section className="mt-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            Strengths
          </h4>
          <ul className="mt-2 flex flex-col gap-1.5">
            {result.strengths.map((strength, index) => (
              <li key={index} className="text-sm leading-relaxed text-ink-muted">
                {strength}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.fixes.length > 0 ? (
        <section className="mt-5 border-t border-hairline pt-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">
            <Wrench className="size-3.5 text-accent" />
            Do this next
          </h4>
          <ol className="mt-3 flex flex-col gap-3">
            {[...result.fixes]
              .sort((a, b) => a.priority - b.priority)
              .map((fix, index) => (
                <li key={index} className="flex gap-3">
                  <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
                    {fix.priority}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm leading-relaxed text-ink">{fix.action}</p>
                    <p className="mt-0.5 text-xs font-semibold text-accent">
                      {fix.where}
                    </p>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
