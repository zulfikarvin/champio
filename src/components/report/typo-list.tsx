import { SpellCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Typo, TypoKind } from "@/lib/schemas/evaluation";

/**
 * Mechanical errors to fix before submitting.
 *
 * Kept separate from the scored criteria on purpose. A typo does not move a
 * rubric score — no guidebook has a "spelling" criterion — but judges notice
 * them, and a team fixing their proposal wants this as a checklist rather than
 * buried inside a criterion's issue list.
 *
 * Each entry shows the quoted text struck through beside its correction, so the
 * team can find the error by searching their own document. That quote is what
 * makes the section verifiable: an entry nobody can locate is one the model
 * invented, and it would be visible here rather than taken on trust.
 */

const KIND_LABELS: Record<TypoKind, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  consistency: "Consistency",
  formatting: "Formatting",
};

const KIND_STYLES: Record<TypoKind, string> = {
  spelling: "bg-red-50 text-red-700",
  grammar: "bg-amber-50 text-amber-700",
  punctuation: "bg-violet-100 text-secondary",
  consistency: "bg-blue-50 text-blue-700",
  formatting: "bg-canvas text-ink-muted",
};

export function TypoList({ typos }: { typos: Typo[] }) {
  if (typos.length === 0) return null;

  // Grouped by location so a team fixing page 3 sees everything on page 3 at once.
  const byLocation = new Map<string, Typo[]>();
  for (const typo of typos) {
    const existing = byLocation.get(typo.where);
    if (existing) existing.push(typo);
    else byLocation.set(typo.where, [typo]);
  }

  return (
    <section className="card p-5 sm:p-6">
      <header className="mb-1 flex flex-wrap items-center gap-2">
        <SpellCheck className="size-4 text-accent" />
        <h2 className="font-bold text-primary">Typos &amp; corrections</h2>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-secondary">
          {typos.length}
        </span>
      </header>
      <p className="mb-4 text-sm text-ink-muted">
        These do not affect your score, but judges read them. Search your document
        for the quoted text to find each one.
      </p>

      <div className="flex flex-col gap-5">
        {[...byLocation.entries()].map(([location, entries]) => (
          <div key={location}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">
              {location}
            </h3>

            <ul className="flex flex-col gap-2.5">
              {entries.map((typo, index) => (
                <li
                  key={`${location}-${index}`}
                  className="rounded-[12px] border border-hairline p-3"
                >
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
                    {/* Wrapping in a container that can scroll keeps a long quote
                        from pushing the report sideways on a 390px screen. */}
                    <span className="min-w-0 break-words text-ink-muted line-through decoration-red-400">
                      {typo.quote}
                    </span>
                    <span aria-hidden className="text-ink-muted">
                      →
                    </span>
                    <span className="min-w-0 break-words font-semibold text-primary">
                      {typo.correction}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      KIND_STYLES[typo.kind],
                    )}
                  >
                    {KIND_LABELS[typo.kind]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
