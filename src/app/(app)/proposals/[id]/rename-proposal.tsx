"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { renameProposalAction } from "@/app/(app)/proposals/actions";

/**
 * The competition name, editable in place.
 *
 * Renders as the page's `h1` until you click the pencil, so the heading keeps its
 * document outline and its weight rather than sitting inside a form control that
 * happens to look like a heading. Escape cancels, Enter saves — the shortcuts you
 * would expect from renaming a file.
 */
export function RenameProposal({
  proposalId,
  title,
}: {
  proposalId: string;
  title: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();

  // The draft is seeded when editing starts rather than synced from the prop by an
  // effect: it only exists while the input is open, so there is nothing to keep in
  // step the rest of the time.
  function startEditing() {
    setValue(title);
    setEditing(true);
  }

  function save() {
    const next = value.trim();

    if (next === title) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await renameProposalAction({ proposalId, title: next });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Renamed.");
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    setValue(title);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <h1 className="display-lg text-primary">{title}</h1>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Rename this competition"
          className="mt-2 rounded-[10px] p-1.5 text-ink-muted opacity-0 transition-opacity hover:bg-violet-100 hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        onFocus={(event) => event.target.select()}
        value={value}
        disabled={pending}
        maxLength={200}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") cancel();
        }}
        className="display-lg w-full min-w-0 rounded-[12px] border-2 border-accent bg-surface px-3 py-1 text-primary outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        aria-label="Save the new name"
        className="rounded-[10px] bg-accent p-2 text-white transition-colors hover:bg-secondary disabled:opacity-60"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={pending}
        aria-label="Cancel renaming"
        className="rounded-[10px] p-2 text-ink-muted transition-colors hover:bg-violet-100 hover:text-accent disabled:opacity-60"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
