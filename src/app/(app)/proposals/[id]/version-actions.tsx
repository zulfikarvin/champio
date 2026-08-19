"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteVersionAction,
  renameVersionAction,
} from "@/app/(app)/proposals/actions";

/**
 * Rename and delete controls for one version.
 *
 * Deletion is confirmed inline rather than through `window.confirm`, because the
 * thing being destroyed needs describing — a version takes its evaluations and its
 * uploaded file with it, and that is worth saying before the click rather than
 * after. The confirm step also gives an accidental click somewhere harmless to
 * land.
 *
 * `canDelete` mirrors the DELETE policy (`is_team_owner`). Hiding the control from
 * a non-owner is courtesy; the database is what actually refuses.
 */
export function VersionActions({
  versionId,
  versionNumber,
  label,
  canDelete,
}: {
  versionId: string;
  versionNumber: number;
  label: string | null;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(label ?? "");
  const [pending, startTransition] = useTransition();

  // The draft is seeded when editing starts rather than synced from the prop by an
  // effect: it only exists while the input is open, so there is nothing to keep in
  // step the rest of the time.
  function startEditing() {
    setValue(label ?? "");
    setEditing(true);
  }

  function save() {
    const next = value.trim();

    if (next === (label ?? "")) {
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await renameVersionAction({ versionId, label: next });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(next === "" ? "Name cleared." : "Renamed.");
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteVersionAction(versionId);
      if (result.status === "error") {
        toast.error(result.message);
        setConfirming(false);
        return;
      }
      toast.success(`v${versionNumber} deleted.`);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="flex w-full items-center gap-2">
        <input
          autoFocus
          onFocus={(event) => event.target.select()}
          value={value}
          disabled={pending}
          maxLength={120}
          placeholder={`v${versionNumber}`}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") {
              setValue(label ?? "");
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 rounded-[10px] border-2 border-accent bg-surface px-2.5 py-1 text-sm font-semibold text-primary outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={save}
          disabled={pending}
          aria-label="Save the version name"
          className="rounded-[8px] bg-accent p-1.5 text-white transition-colors hover:bg-secondary disabled:opacity-60"
        >
          <Check className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(label ?? "");
            setEditing(false);
          }}
          disabled={pending}
          aria-label="Cancel renaming"
          className="rounded-[8px] p-1.5 text-ink-muted transition-colors hover:bg-violet-100 hover:text-accent disabled:opacity-60"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2 rounded-[12px] bg-red-50 px-3 py-2">
        <span className="text-sm text-red-700">
          Delete v{versionNumber}, its score and its file? This cannot be undone.
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-[8px] bg-red-600 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-[8px] px-3 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
          >
            Keep
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Rename version ${versionNumber}`}
        className="rounded-[8px] p-1.5 text-ink-muted transition-colors hover:bg-violet-100 hover:text-accent"
      >
        <Pencil className="size-3.5" />
      </button>
      {canDelete ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete version ${versionNumber}`}
          className="rounded-[8px] p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
