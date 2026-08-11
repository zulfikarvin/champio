import { scoreBand } from "@/components/report/score-badge";

const BAND_COLOR: Record<ReturnType<typeof scoreBand>, string> = {
  strong: "#059669",
  solid: "#7b2cbf",
  developing: "#d97706",
  weak: "#dc2626",
};

const BAND_LABEL: Record<ReturnType<typeof scoreBand>, string> = {
  strong: "Final-ready",
  solid: "Competitive",
  developing: "Developing",
  weak: "Needs rework",
};

/**
 * The headline score.
 *
 * Inline SVG rather than a chart library: it is one arc, it must render on the
 * server with no hydration, and it has to hold up at 390px where a canvas-based
 * gauge would either overflow or blur.
 */
export function ScoreRing({ score }: { score: number }) {
  const band = scoreBand(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(Math.max(score, 0), 100) / 100) * circumference;

  return (
    <div className="flex items-center gap-5">
      <svg
        viewBox="0 0 128 128"
        className="size-28 shrink-0 -rotate-90"
        role="img"
        aria-label={`Overall score ${score.toFixed(1)} out of 100`}
      >
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="#ece8f2"
          strokeWidth="12"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={BAND_COLOR[band]}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>

      <div className="min-w-0">
        <p className="text-4xl font-extrabold tabular-nums leading-none text-primary">
          {score.toFixed(1)}
          <span className="text-lg font-bold text-ink-muted">/100</span>
        </p>
        <p
          className="mt-1.5 text-sm font-semibold"
          style={{ color: BAND_COLOR[band] }}
        >
          {BAND_LABEL[band]}
        </p>
      </div>
    </div>
  );
}
