"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { createProposalAction } from "@/app/(app)/proposals/actions";
import { initialCreateProposalState } from "@/app/(app)/proposals/form-state";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type TrackOption = {
  id: string;
  name: string;
  /** The built-in rubric for this track — the starting point before a guidebook. */
  defaultRubricId: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Creating…" : "Create competition"}
    </Button>
  );
}

/**
 * Creating a competition entry.
 *
 * Only a title and a format. The rubric is not chosen here: it starts as the
 * track's built-in default and is replaced by uploading the competition's
 * guidebook on the entry itself. Picking a rubric before you have a competition
 * to attach it to was the wrong order — the guidebook is what defines the rubric.
 */
export function NewProposalForm({ tracks }: { tracks: TrackOption[] }) {
  const [state, formAction] = useActionState(
    createProposalAction,
    initialCreateProposalState,
  );

  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const selected = tracks.find((t) => t.id === trackId) ?? tracks[0];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field
        label="Competition name"
        htmlFor="title"
        hint="However you refer to it — the organiser's name works well."
      >
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          placeholder="ISAC 2026 — Business Case"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`track-${trackId}`}>Competition format</Label>
        <input type="hidden" name="trackId" value={trackId} />
        <input
          type="hidden"
          name="rubricId"
          value={selected?.defaultRubricId ?? ""}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          {tracks.map((track) => (
            <button
              key={track.id}
              id={`track-${track.id}`}
              type="button"
              onClick={() => setTrackId(track.id)}
              aria-pressed={track.id === trackId}
              className={cn(
                "rounded-[12px] border p-3 text-left text-sm transition-colors",
                track.id === trackId
                  ? "border-accent bg-violet-100 font-semibold text-primary"
                  : "border-hairline bg-surface text-ink-muted hover:border-accent-light",
              )}
            >
              {track.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          Scoring starts with Champio&rsquo;s built-in rubric for this format.
          Upload the competition&rsquo;s guidebook afterwards and the real judging
          criteria replace it.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[12px] bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
