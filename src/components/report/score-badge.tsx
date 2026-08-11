import { cn } from "@/lib/cn";

/**
 * Score bands.
 *
 * These mirror the calibration language in the evaluation prompt: 5–6 is the
 * honest centre for a competent submission, 7+ is earned. Colouring a 6 amber
 * rather than green is deliberate — a green 6 would tell a team they are ready
 * when the prompt was written to say they are not yet.
 */
export function scoreBand(score: number): "strong" | "solid" | "developing" | "weak" {
  if (score >= 80) return "strong";
  if (score >= 65) return "solid";
  if (score >= 45) return "developing";
  return "weak";
}

const BAND_STYLES: Record<ReturnType<typeof scoreBand>, string> = {
  strong: "bg-emerald-50 text-emerald-700",
  solid: "bg-violet-100 text-secondary",
  developing: "bg-amber-50 text-amber-700",
  weak: "bg-red-50 text-red-700",
};

export function ScoreBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score === null) {
    return (
      <span
        className={cn(
          "shrink-0 rounded-full bg-canvas px-3 py-1.5 text-xs font-semibold text-ink-muted",
          className,
        )}
      >
        Not scored
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums",
        BAND_STYLES[scoreBand(score)],
        className,
      )}
    >
      {score.toFixed(1)}
      <span className="text-[11px] font-semibold opacity-60">/100</span>
    </span>
  );
}
