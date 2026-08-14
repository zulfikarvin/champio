import { ChevronRight, FileText, Mic, Scale, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { RubricDetail } from "@/lib/proposals";
import { STAGE_LABELS, type RubricStage } from "@/lib/schemas/rubric";

/**
 * Read-only view of the rubrics a competition is judged by.
 *
 * Visible at all times, not just while a compiled draft is awaiting review. A
 * team should be able to read the criteria their score comes from — and until
 * now the built-in rubric had no surface anywhere in the product, so nobody could
 * see what "Champio Default — Business Plan" actually contained.
 *
 * Collapsed by default via <details>: this is reference material, and expanded it
 * would push the version timeline off the screen. No JavaScript involved, so it
 * works in the server component and costs nothing to hydrate.
 */

const STAGE_ICONS: Record<RubricStage, typeof FileText> = {
  proposal: FileText,
  presentation: Mic,
  prototype: Scale,
  other: Scale,
};

export function RubricView({ rubrics }: { rubrics: RubricDetail[] }) {
  if (rubrics.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {rubrics.map((detail) => {
        const StageIcon = STAGE_ICONS[detail.stage];
        const criteriaCount = detail.rubric.criteria.length;

        return (
          <details key={detail.id} className="card group overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 transition-colors hover:bg-violet-100/40">
              <ChevronRight className="size-4 shrink-0 text-ink-muted transition-transform group-open:rotate-90" />

              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                  detail.isActive
                    ? "bg-accent text-white"
                    : "bg-violet-100 text-secondary",
                )}
              >
                <StageIcon className="size-3" />
                {STAGE_LABELS[detail.stage]}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-primary">
                  {detail.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {criteriaCount} criteria
                  {detail.isActive ? " · scores your uploads" : ""}
                  {detail.isDefault ? " · built-in" : ""}
                </span>
              </span>

              {detail.isDefault ? (
                <Sparkles className="size-4 shrink-0 text-violet-300" />
              ) : null}
            </summary>

            <div className="border-t border-hairline px-5 pb-5 pt-4">
              <ul className="flex flex-col gap-4">
                {detail.rubric.criteria.map((criterion) => (
                  <li key={criterion.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-semibold text-primary">
                        {criterion.label}
                      </h4>
                      <span className="text-xs font-bold tabular-nums text-accent">
                        {(criterion.weight * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div
                      className="mt-1.5 h-1 overflow-hidden rounded-full bg-canvas"
                      role="img"
                      aria-label={`${(criterion.weight * 100).toFixed(0)} percent of the score`}
                    >
                      <div
                        className="h-full rounded-full bg-accent-light"
                        style={{ width: `${criterion.weight * 100}%` }}
                      />
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {criterion.description}
                    </p>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-accent">
                        Scoring guide (
                        {Object.keys(criterion.scoring_guide).length} bands)
                      </summary>
                      <dl className="mt-2 flex flex-col gap-1.5">
                        {Object.entries(criterion.scoring_guide).map(
                          ([range, text]) => (
                            <div key={range} className="flex gap-2 text-xs">
                              <dt className="w-12 shrink-0 font-bold tabular-nums text-secondary">
                                {range}
                              </dt>
                              <dd className="min-w-0 text-ink-muted">{text}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                  </li>
                ))}
              </ul>

              {detail.rubric.format_rules.max_slides ||
              detail.rubric.format_rules.max_pages ||
              detail.rubric.format_rules.max_words ||
              detail.rubric.format_rules.language ||
              detail.rubric.format_rules.other.length > 0 ? (
                <div className="mt-5 border-t border-hairline pt-4">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                    Format rules
                  </h4>
                  <ul className="flex flex-col gap-1 text-sm text-ink-muted">
                    {detail.rubric.format_rules.max_pages ? (
                      <li>Maximum {detail.rubric.format_rules.max_pages} pages</li>
                    ) : null}
                    {detail.rubric.format_rules.max_slides ? (
                      <li>Maximum {detail.rubric.format_rules.max_slides} slides</li>
                    ) : null}
                    {detail.rubric.format_rules.max_words ? (
                      <li>Maximum {detail.rubric.format_rules.max_words} words</li>
                    ) : null}
                    {detail.rubric.format_rules.language ? (
                      <li>
                        Language:{" "}
                        {detail.rubric.format_rules.language === "id"
                          ? "Bahasa Indonesia"
                          : "English"}
                      </li>
                    ) : null}
                    {detail.rubric.format_rules.other.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-muted">
                    Countable limits are checked in code against your uploaded
                    document, not judged by the model.
                  </p>
                </div>
              ) : null}

              {!detail.isActive ? (
                <p className="mt-4 rounded-[12px] bg-violet-100/60 px-3 py-2 text-xs leading-relaxed text-secondary-dark">
                  This rubric does not score your uploads — it is what judges will
                  use at the {STAGE_LABELS[detail.stage].toLowerCase()} stage.
                </p>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
