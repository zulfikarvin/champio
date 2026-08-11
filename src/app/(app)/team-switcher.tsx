"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState, useTransition } from "react";
import { switchTeamAction } from "@/app/(app)/actions";
import { cn } from "@/lib/cn";
import type { Membership } from "@/lib/teams";

export function TeamSwitcher({
  memberships,
  activeTeamId,
}: {
  memberships: Membership[];
  activeTeamId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = memberships.find((m) => m.teamId === activeTeamId);

  function select(teamId: string) {
    setOpen(false);
    if (teamId === activeTeamId) return;

    const formData = new FormData();
    formData.set("teamId", teamId);
    startTransition(() => {
      void switchTeamAction(formData);
    });
  }

  // A single team needs no control — showing a dropdown that cannot go anywhere
  // is just noise.
  if (memberships.length <= 1) {
    return (
      <div className="rounded-[12px] bg-violet-100 px-3 py-2">
        <p className="truncate text-sm font-semibold text-primary">
          {active?.teamName ?? "—"}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center justify-between gap-2 rounded-[12px] bg-violet-100 px-3 py-2 text-left transition-colors hover:bg-violet-200/60 disabled:opacity-60"
      >
        <span className="truncate text-sm font-semibold text-primary">
          {active?.teamName ?? "Select team"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-secondary" />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-[12px] border border-hairline bg-surface shadow-[0_12px_24px_-10px_rgba(16,0,43,0.18)]"
        >
          {memberships.map((membership) => {
            const isActive = membership.teamId === activeTeamId;
            return (
              <li key={membership.teamId} role="option" aria-selected={isActive}>
                <button
                  type="button"
                  onClick={() => select(membership.teamId)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-violet-100",
                    isActive ? "font-semibold text-primary" : "text-ink-muted",
                  )}
                >
                  <span className="truncate">{membership.teamName}</span>
                  {isActive ? (
                    <Check className="size-4 shrink-0 text-accent" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
