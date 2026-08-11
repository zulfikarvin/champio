"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { EvaluationStatus } from "@/lib/db";

/**
 * Live pipeline state for one evaluation.
 *
 * Subscribes to the evaluation row over Realtime, which honours the SELECT policy
 * on `evaluations` — so a team only ever receives its own updates, with no
 * filtering needed on this side.
 *
 * There is also a slow poll. Realtime is a delivery optimisation, not a
 * guarantee: a dropped socket or a missed event during a reconnect would
 * otherwise leave a spinner turning forever on a job that finished a minute ago.
 */

const LABELS: Record<EvaluationStatus, string> = {
  queued: "Queued",
  extracting: "Reading the document",
  evaluating: "Judging against the rubric",
  complete: "Complete",
  failed: "Failed",
};

const POLL_MS = 5000;

export function EvaluationProgress({
  evaluationId,
  initialStatus,
}: {
  evaluationId: string;
  initialStatus: EvaluationStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<EvaluationStatus>(initialStatus);

  useEffect(() => {
    if (status === "complete" || status === "failed") return;

    const supabase = createBrowserSupabase();
    let cancelled = false;

    const settle = (next: EvaluationStatus) => {
      if (cancelled) return;
      setStatus(next);
      // Refresh so the server components re-read the score and report link.
      if (next === "complete" || next === "failed") router.refresh();
    };

    const channel = supabase
      .channel(`evaluation:${evaluationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "evaluations",
          filter: `id=eq.${evaluationId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: EvaluationStatus }).status;
          if (next) settle(next);
        },
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase
        .from("evaluations")
        .select("status")
        .eq("id", evaluationId)
        .maybeSingle();
      if (data?.status) settle(data.status);
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [evaluationId, status, router]);

  if (status === "complete" || status === "failed") return null;

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-secondary"
    >
      <Loader2 className="size-3.5 animate-spin" />
      {LABELS[status]}
    </span>
  );
}
