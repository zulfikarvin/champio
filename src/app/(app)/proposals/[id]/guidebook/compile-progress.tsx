"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { GuidebookStatus } from "@/lib/db";

/**
 * Live compilation state for one guidebook.
 *
 * `guidebooks` is not in the Realtime publication (only `evaluations` is), so
 * this polls rather than subscribes. Compilation takes roughly as long as an
 * evaluation — tens of seconds — so a 3s poll is a handful of cheap queries, not
 * a busy loop, and it avoids adding a publication for a single screen.
 */

const LABELS: Record<GuidebookStatus, string> = {
  uploaded: "Queued",
  compiling: "Reading the guidebook",
  complete: "Complete",
  failed: "Failed",
};

const POLL_MS = 3000;

export function CompileProgress({
  guidebookId,
  initialStatus,
}: {
  guidebookId: string;
  initialStatus: GuidebookStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<GuidebookStatus>(initialStatus);

  useEffect(() => {
    if (status === "complete" || status === "failed") return;

    const supabase = createBrowserSupabase();
    let cancelled = false;

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("guidebooks")
        .select("status")
        .eq("id", guidebookId)
        .maybeSingle();

      if (cancelled || !data?.status) return;
      if (data.status !== status) {
        setStatus(data.status);
        // Re-render the server component so the compiled draft appears.
        if (data.status === "complete" || data.status === "failed") router.refresh();
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [guidebookId, status, router]);

  if (status === "complete" || status === "failed") return null;

  return (
    <div className="card flex items-center gap-4 p-6">
      <Loader2 className="size-5 shrink-0 animate-spin text-accent" />
      <div>
        <p className="font-semibold text-primary">{LABELS[status]}</p>
        <p className="mt-0.5 text-sm text-ink-muted">
          Extracting the judging criteria and weights. This usually takes under a
          minute.
        </p>
      </div>
    </div>
  );
}
