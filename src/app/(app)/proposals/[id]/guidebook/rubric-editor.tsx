"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, Mic, Save, Scale } from "lucide-react";
import { toast } from "sonner";
import { saveProposalRubricAction } from "@/app/(app)/proposals/guidebook-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { DraftSection } from "@/lib/guidebooks";
import { STAGE_LABELS, type Rubric, type RubricStage } from "@/lib/schemas/rubric";

/**
 * Review-and-correct for everything a guidebook compiled.
 *
 * A guidebook defines several assessments — the written proposal and the live
 * presentation are scored by separate tables, each summing to 100%. They are kept
 * apart here for the same reason they are kept apart in the database: merging them
 * would halve every weight and let delivery criteria judge a document.
 *
 * Weights are edited as **percentages**, because that is how guidebooks state
 * them and how people think about them. They convert back to the 0–1 distribution
 * `rubricSchema` requires only on save. Each section must reach 100% on its own.
 */

const TOLERANCE = 0.5; // percentage points

const STAGE_ICONS: Record<RubricStage, typeof FileText> = {
  proposal: FileText,
  presentation: Mic,
  prototype: Scale,
  other: Scale,
};

type EditableCriterion = Rubric["criteria"][number] & { percent: string };

type EditableSection = {
  stage: RubricStage;
  sectionName: string;
  name: string;
  criteria: EditableCriterion[];
  formatRules: Rubric["format_rules"];
};

function toEditable(sections: DraftSection[]): EditableSection[] {
  return sections.map((section) => ({
    stage: section.stage,
    sectionName: section.sectionName,
    name: section.rubric.rubric_name,
    criteria: section.rubric.criteria.map((criterion) => ({
      ...criterion,
      // Stored as a string so the field can be cleared while typing without
      // snapping to 0.
      percent: (criterion.weight * 100).toFixed(1).replace(/\.0$/, ""),
    })),
    formatRules: section.rubric.format_rules,
  }));
}

export function RubricEditor({
  guidebookId,
  sections: draftSections,
}: {
  guidebookId: string;
  sections: DraftSection[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sections, setSections] = useState<EditableSection[]>(() =>
    toEditable(draftSections),
  );

  const totals = sections.map((section) =>
    section.criteria.reduce((sum, c) => sum + (Number(c.percent) || 0), 0),
  );
  const allBalanced = totals.every((total) => Math.abs(total - 100) <= TOLERANCE);

  function updateSection(index: number, patch: Partial<EditableSection>) {
    setSections((prev) =>
      prev.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    );
  }

  function updateCriterion(
    sectionIndex: number,
    criterionIndex: number,
    patch: Partial<EditableCriterion>,
  ) {
    setSections((prev) =>
      prev.map((section, i) =>
        i === sectionIndex
          ? {
              ...section,
              criteria: section.criteria.map((criterion, j) =>
                j === criterionIndex ? { ...criterion, ...patch } : criterion,
              ),
            }
          : section,
      ),
    );
  }

  /** Rescales one section's weights proportionally so its total lands on 100. */
  function rebalance(sectionIndex: number) {
    setSections((prev) =>
      prev.map((section, i) => {
        if (i !== sectionIndex) return section;

        const sum = section.criteria.reduce(
          (total, c) => total + (Number(c.percent) || 0),
          0,
        );
        if (sum <= 0) {
          const equal = (100 / section.criteria.length).toFixed(1);
          return {
            ...section,
            criteria: section.criteria.map((c) => ({ ...c, percent: equal })),
          };
        }
        return {
          ...section,
          criteria: section.criteria.map((c) => ({
            ...c,
            percent: (((Number(c.percent) || 0) / sum) * 100)
              .toFixed(1)
              .replace(/\.0$/, ""),
          })),
        };
      }),
    );
  }

  function save() {
    startTransition(async () => {
      const payload = sections.map((section, index) => ({
        stage: section.stage,
        rubric: {
          rubric_name: section.name.trim(),
          // Back to a 0–1 distribution, normalised against this section's own
          // live total so rounding in the fields cannot push it out of tolerance.
          criteria: section.criteria.map((criterion) => ({
            key: criterion.key,
            label: criterion.label.trim(),
            weight: (Number(criterion.percent) || 0) / totals[index],
            description: criterion.description,
            scoring_guide: criterion.scoring_guide,
          })),
          format_rules: section.formatRules,
        },
      }));

      const result = await saveProposalRubricAction(guidebookId, payload);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(
        sections.length > 1
          ? `Saved ${sections.length} rubrics. Proposals are scored against the proposal one.`
          : "Rubric saved. Versions of this competition will be scored against it.",
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {sections.length > 1 ? (
        <p className="rounded-[12px] bg-violet-100/60 px-4 py-3 text-sm leading-relaxed text-secondary-dark">
          This guidebook scores {sections.length} things separately. Each is saved
          as its own rubric with its own weights — your written proposal is judged
          only by the <strong className="font-semibold">Proposal</strong> criteria,
          never by presentation ones.
        </p>
      ) : null}

      {sections.map((section, sectionIndex) => {
        const total = totals[sectionIndex];
        const balanced = Math.abs(total - 100) <= TOLERANCE;
        const StageIcon = STAGE_ICONS[section.stage];

        return (
          <section key={`${section.stage}-${sectionIndex}`} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                  section.stage === "proposal"
                    ? "bg-accent text-white"
                    : "bg-violet-100 text-secondary",
                )}
              >
                <StageIcon className="size-3.5" />
                {STAGE_LABELS[section.stage]}
              </span>
              <span className="text-xs text-ink-muted">{section.sectionName}</span>
              {section.stage === "proposal" ? (
                <span className="text-xs font-semibold text-accent">
                  scores your uploads
                </span>
              ) : null}
            </div>

            <div className="card p-5">
              <Label htmlFor={`name-${sectionIndex}`}>Rubric name</Label>
              <Input
                id={`name-${sectionIndex}`}
                value={section.name}
                onChange={(event) =>
                  updateSection(sectionIndex, { name: event.target.value })
                }
                className="mt-1.5"
              />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Criteria &amp; weights
                </h3>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      balanced ? "text-emerald-600" : "text-amber-600",
                    )}
                  >
                    {total.toFixed(1)}%
                  </span>
                  {!balanced ? (
                    <button
                      type="button"
                      onClick={() => rebalance(sectionIndex)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-secondary transition-colors hover:bg-violet-200/60"
                    >
                      <Scale className="size-3.5" />
                      Rebalance to 100%
                    </button>
                  ) : null}
                </div>
              </div>

              {!balanced ? (
                <p className="mb-3 flex items-start gap-2 rounded-[12px] bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Weights in this section must total 100%. They decide how much
                    each criterion moves the score, so {total.toFixed(1)}% would
                    rescale every result.
                  </span>
                </p>
              ) : null}

              <ul className="flex flex-col gap-3">
                {section.criteria.map((criterion, criterionIndex) => (
                  <li key={criterion.key} className="card p-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`label-${sectionIndex}-${criterion.key}`}>
                          Label
                        </Label>
                        <Input
                          id={`label-${sectionIndex}-${criterion.key}`}
                          value={criterion.label}
                          onChange={(event) =>
                            updateCriterion(sectionIndex, criterionIndex, {
                              label: event.target.value,
                            })
                          }
                          className="mt-1.5"
                        />
                      </div>

                      <div className="w-28 shrink-0">
                        <Label htmlFor={`weight-${sectionIndex}-${criterion.key}`}>
                          Weight
                        </Label>
                        <div className="relative mt-1.5">
                          <Input
                            id={`weight-${sectionIndex}-${criterion.key}`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.1"
                            value={criterion.percent}
                            onChange={(event) =>
                              updateCriterion(sectionIndex, criterionIndex, {
                                percent: event.target.value,
                              })
                            }
                            className="pr-7 tabular-nums"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">
                            %
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                      {criterion.description}
                    </p>

                    <details className="mt-3">
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

                    <p className="mt-3 font-mono text-[11px] text-ink-muted">
                      key: {criterion.key}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {section.formatRules.max_slides ||
            section.formatRules.max_pages ||
            section.formatRules.max_words ||
            section.formatRules.language ||
            section.formatRules.other.length > 0 ? (
              <div className="card p-5">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
                  Format rules
                </h3>
                <ul className="flex flex-col gap-1 text-sm text-ink">
                  {section.formatRules.max_slides ? (
                    <li>Maximum {section.formatRules.max_slides} slides</li>
                  ) : null}
                  {section.formatRules.max_pages ? (
                    <li>Maximum {section.formatRules.max_pages} pages</li>
                  ) : null}
                  {section.formatRules.max_words ? (
                    <li>Maximum {section.formatRules.max_words} words</li>
                  ) : null}
                  {section.formatRules.language ? (
                    <li>
                      Language:{" "}
                      {section.formatRules.language === "id"
                        ? "Bahasa Indonesia"
                        : "English"}
                    </li>
                  ) : null}
                  {section.formatRules.other.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
        <Button type="button" onClick={save} disabled={!allBalanced || pending}>
          <Save />
          {pending
            ? "Saving…"
            : sections.length > 1
              ? `Save ${sections.length} rubrics`
              : "Save rubric"}
        </Button>
        {!allBalanced ? (
          <span className="text-sm text-ink-muted">
            Every section must total 100% first.
          </span>
        ) : null}
      </div>
    </div>
  );
}
