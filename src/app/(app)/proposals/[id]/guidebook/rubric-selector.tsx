"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ScrollText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { setProposalRubricAction } from "@/app/(app)/proposals/guidebook-actions";
import { cn } from "@/lib/cn";
import type { RubricChoice } from "@/lib/proposals";

/**
 * Chooses which rubric future versions are scored against.
 *
 * Only rendered once there is a real choice — a compiled guidebook rubric
 * alongside the built-in one. Switching affects the next evaluation only:
 * existing scores keep the `rubric_id` they were produced with, so nothing
 * already on the page is rewritten by changing this.
 */
export function RubricSelector({
  proposalId,
  choices,
  activeRubricId,
}: {
  proposalId: string;
  choices: RubricChoice[];
  activeRubricId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (choices.length < 2) return null;

  function select(rubricId: string) {
    if (rubricId === activeRubricId) return;

    startTransition(async () => {
      const result = await setProposalRubricAction({ proposalId, rubricId });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Rubric updated. New versions will be scored against it.");
      router.refresh();
    });
  }

  return (
    <fieldset disabled={pending} className="mt-4">
      <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
        Score against
      </legend>

      <div className="flex flex-col gap-2">
        {choices.map((choice) => {
          const active = choice.id === activeRubricId;

          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => select(choice.id)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-accent bg-violet-100"
                  : "border-hairline bg-surface hover:border-accent-light",
                pending && "opacity-60",
              )}
            >
              {choice.isDefault ? (
                <Sparkles
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    active ? "text-accent" : "text-ink-muted",
                  )}
                />
              ) : (
                <ScrollText
                  className={cn(
                    "mt-0.5 size-4 shrink-0",
                    active ? "text-accent" : "text-ink-muted",
                  )}
                />
              )}

              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm",
                    active ? "font-semibold text-primary" : "text-ink",
                  )}
                >
                  {choice.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {choice.isDefault
                    ? "Champio's built-in rubric for this format"
                    : "Compiled from your competition's guidebook"}
                </span>
              </span>

              {active ? (
                <Check className="mt-0.5 size-4 shrink-0 text-accent" />
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Applies to versions you upload from now on. Scores already on this page
        keep the rubric they were measured against.
      </p>
    </fieldset>
  );
}
