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
  rubrics: { id: string; name: string; isDefault: boolean }[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Creating…" : "Create proposal"}
    </Button>
  );
}

export function NewProposalForm({ tracks }: { tracks: TrackOption[] }) {
  const [state, formAction] = useActionState(
    createProposalAction,
    initialCreateProposalState,
  );

  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const selectedTrack = tracks.find((t) => t.id === trackId) ?? tracks[0];
  const rubrics = selectedTrack?.rubrics ?? [];

  // Default to the built-in rubric; a team rubric is an explicit choice.
  const [rubricId, setRubricId] = useState(
    rubrics.find((r) => r.isDefault)?.id ?? rubrics[0]?.id ?? "",
  );

  function selectTrack(id: string) {
    setTrackId(id);
    const next = tracks.find((t) => t.id === id)?.rubrics ?? [];
    setRubricId(next.find((r) => r.isDefault)?.id ?? next[0]?.id ?? "");
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field label="Proposal title" htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          minLength={3}
          placeholder="Reviving Warung Retail — ISAC 2026"
        />
      </Field>

      <div className="flex flex-col gap-2">
        <Label htmlFor="track-essay">Competition format</Label>
        <input type="hidden" name="trackId" value={trackId} />
        <div className="grid gap-2 sm:grid-cols-3">
          {tracks.map((track) => (
            <button
              key={track.id}
              id={`track-${track.id}`}
              type="button"
              onClick={() => selectTrack(track.id)}
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="rubricId">Rubric</Label>
        <input type="hidden" name="rubricId" value={rubricId} />
        <div className="flex flex-col gap-2">
          {rubrics.map((rubric) => (
            <button
              key={rubric.id}
              type="button"
              onClick={() => setRubricId(rubric.id)}
              aria-pressed={rubric.id === rubricId}
              className={cn(
                "flex items-center justify-between gap-2 rounded-[12px] border px-3 py-2.5 text-left text-sm transition-colors",
                rubric.id === rubricId
                  ? "border-accent bg-violet-100 font-semibold text-primary"
                  : "border-hairline bg-surface text-ink-muted hover:border-accent-light",
              )}
            >
              <span className="truncate">{rubric.name}</span>
              {rubric.isDefault ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-secondary">
                  Built-in
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">
          The rubric is fixed once an evaluation runs, so every version is scored
          the same way.
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
