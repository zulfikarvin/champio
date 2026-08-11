import { Construction } from "lucide-react";

/**
 * Stand-in for a screen a later phase delivers. Exists so navigation is complete
 * from Phase 1 rather than dead-ending in a 404, and so the phase each screen
 * belongs to is visible in the product itself.
 */
export function PhasePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: number;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="display-lg mb-2 text-primary">{title}</h1>
      <div className="card mt-6 flex flex-col items-start gap-3 p-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-secondary">
          <Construction className="size-3.5" />
          Phase {phase}
        </span>
        <p className="text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
    </div>
  );
}
