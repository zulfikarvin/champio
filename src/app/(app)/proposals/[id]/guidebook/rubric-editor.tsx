"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save, Scale } from "lucide-react";
import { toast } from "sonner";
import { saveProposalRubricAction } from "@/app/(app)/proposals/guidebook-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Rubric } from "@/lib/schemas/rubric";

/**
 * Review-and-correct screen for a compiled rubric.
 *
 * Weights are edited as **percentages**, because that is how guidebooks state
 * them and how people think about them. They are converted back to the 0–1
 * distribution `rubricSchema` requires only on save. Editing 0.25 in a text box
 * is a needless translation for the user to perform.
 *
 * The running total is shown live and must reach 100% before saving is allowed.
 * That is the same rule the schema enforces server-side — surfacing it here means
 * the user fixes it while looking at the numbers, rather than getting a rejection
 * after clicking save.
 */

const TOLERANCE = 0.5; // percentage points

export function RubricEditor({
  guidebookId,
  draft,
}: {
  guidebookId: string;
  draft: Rubric;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(draft.rubric_name);
  const [criteria, setCriteria] = useState(
    draft.criteria.map((criterion) => ({
      ...criterion,
      // Stored as a string so the field can be cleared while typing without
      // snapping to 0.
      percent: (criterion.weight * 100).toFixed(1).replace(/\.0$/, ""),
    })),
  );

  const total = criteria.reduce(
    (sum, criterion) => sum + (Number(criterion.percent) || 0),
    0,
  );
  const balanced = Math.abs(total - 100) <= TOLERANCE;

  function update(index: number, patch: Partial<(typeof criteria)[number]>) {
    setCriteria((prev) =>
      prev.map((criterion, i) => (i === index ? { ...criterion, ...patch } : criterion)),
    );
  }

  /** Rescales every weight proportionally so the total lands on exactly 100. */
  function rebalance() {
    const sum = criteria.reduce((s, c) => s + (Number(c.percent) || 0), 0);
    if (sum <= 0) {
      const equal = (100 / criteria.length).toFixed(1);
      setCriteria((prev) => prev.map((c) => ({ ...c, percent: equal })));
      return;
    }
    setCriteria((prev) =>
      prev.map((c) => ({
        ...c,
        percent: (((Number(c.percent) || 0) / sum) * 100).toFixed(1).replace(/\.0$/, ""),
      })),
    );
  }

  function save() {
    startTransition(async () => {
      const payload: Rubric = {
        rubric_name: name.trim(),
        // Back to a 0–1 distribution, normalised against the live total so
        // rounding in the percentage fields cannot push the sum outside tolerance.
        criteria: criteria.map((criterion) => ({
          key: criterion.key,
          label: criterion.label.trim(),
          weight: (Number(criterion.percent) || 0) / total,
          description: criterion.description,
          scoring_guide: criterion.scoring_guide,
        })),
        format_rules: draft.format_rules,
      };

      const result = await saveProposalRubricAction(guidebookId, payload);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Rubric saved. Versions of this competition will be scored against it.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-5">
        <Label htmlFor="rubric-name">Rubric name</Label>
        <Input
          id="rubric-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-1.5"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Shown on the evaluation report for every version of this competition.
        </p>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink-muted">
            Criteria &amp; weights
          </h2>
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
                onClick={rebalance}
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
              Weights must total 100%. They decide how much each criterion moves
              the overall score, so a total of {total.toFixed(1)}% would rescale
              every result.
            </span>
          </p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {criteria.map((criterion, index) => (
            <li key={criterion.key} className="card p-5">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`label-${criterion.key}`}>Label</Label>
                  <Input
                    id={`label-${criterion.key}`}
                    value={criterion.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    className="mt-1.5"
                  />
                </div>

                <div className="w-28 shrink-0">
                  <Label htmlFor={`weight-${criterion.key}`}>Weight</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id={`weight-${criterion.key}`}
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={criterion.percent}
                      onChange={(event) =>
                        update(index, { percent: event.target.value })
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
                  Scoring guide ({Object.keys(criterion.scoring_guide).length} bands)
                </summary>
                <dl className="mt-2 flex flex-col gap-1.5">
                  {Object.entries(criterion.scoring_guide).map(([range, text]) => (
                    <div key={range} className="flex gap-2 text-xs">
                      <dt className="w-12 shrink-0 font-bold tabular-nums text-secondary">
                        {range}
                      </dt>
                      <dd className="min-w-0 text-ink-muted">{text}</dd>
                    </div>
                  ))}
                </dl>
              </details>

              <p className="mt-3 font-mono text-[11px] text-ink-muted">
                key: {criterion.key}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {draft.format_rules.other.length > 0 ||
      draft.format_rules.max_slides ||
      draft.format_rules.max_pages ||
      draft.format_rules.max_words ||
      draft.format_rules.language ? (
        <div className="card p-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
            Format rules
          </h2>
          <ul className="flex flex-col gap-1 text-sm text-ink">
            {draft.format_rules.max_slides ? (
              <li>Maximum {draft.format_rules.max_slides} slides</li>
            ) : null}
            {draft.format_rules.max_pages ? (
              <li>Maximum {draft.format_rules.max_pages} pages</li>
            ) : null}
            {draft.format_rules.max_words ? (
              <li>Maximum {draft.format_rules.max_words} words</li>
            ) : null}
            {draft.format_rules.language ? (
              <li>
                Language:{" "}
                {draft.format_rules.language === "id"
                  ? "Bahasa Indonesia"
                  : "English"}
              </li>
            ) : null}
            {draft.format_rules.other.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            Countable limits are checked in code against your uploaded document,
            not judged by the model.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" onClick={save} disabled={!balanced || pending}>
          <Save />
          {pending ? "Saving…" : "Save rubric"}
        </Button>
        {!balanced ? (
          <span className="text-sm text-ink-muted">
            Weights must total 100% first.
          </span>
        ) : null}
      </div>
    </div>
  );
}
