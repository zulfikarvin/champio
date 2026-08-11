import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { getTrack } from "@/lib/learning";

export const metadata: Metadata = { title: "Track" };

export default async function TrackPage({ params }: PageProps<"/tracks/[slug]">) {
  const { slug } = await params;
  const track = await getTrack(slug);
  if (!track) notFound();

  const totalMinutes = track.modules.reduce((sum, m) => sum + m.estMinutes, 0);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href="/tracks"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Learning Tracks
      </Link>

      <header className="mb-8">
        <h1 className="display-lg text-primary">{track.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {track.description}
        </p>

        {track.modules.length > 0 ? (
          <>
            <div className="mt-5 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-canvas"
                role="img"
                aria-label={`${track.progressPercent}% complete`}
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${track.progressPercent}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                {track.progressPercent}%
              </span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">
              {track.completedCount} of {track.modules.length} modules ·{" "}
              {totalMinutes} min total
            </p>
          </>
        ) : null}
      </header>

      {track.modules.length === 0 ? (
        <div className="card p-8">
          <h2 className="text-lg font-bold text-primary">No modules yet</h2>
          <p className="mt-2 text-sm text-ink-muted">
            This track has no content yet. The Business Plan track is the one
            currently built out.
          </p>
        </div>
      ) : (
        /* The skill tree. A vertical spine with one node per module — it reads the
           same at 390px as on a desktop, which a branching tree would not. */
        <ol className="relative flex flex-col gap-3">
          {track.modules.map((module, index) => {
            const isLast = index === track.modules.length - 1;
            const locked = !module.unlocked;

            const node = (
              <div
                className={cn(
                  "card flex items-start gap-4 p-5 transition-shadow",
                  locked && "opacity-60",
                  !locked &&
                    "hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    module.completed
                      ? "bg-emerald-500 text-white"
                      : locked
                        ? "bg-canvas text-ink-muted"
                        : "bg-accent text-white",
                  )}
                >
                  {module.completed ? (
                    <Check className="size-4.5" />
                  ) : locked ? (
                    <Lock className="size-4" />
                  ) : (
                    module.orderIndex
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-primary">{module.title}</h2>
                    {module.isDraft ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                        DRAFT
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {module.estMinutes} min
                    </span>
                    {module.hasQuiz ? <span>Quiz</span> : null}
                    {module.bestScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold",
                          module.completed ? "text-emerald-600" : "text-amber-600",
                        )}
                      >
                        Best {module.bestScore}%
                      </span>
                    ) : null}
                  </p>

                  {locked ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      Pass the previous module&rsquo;s quiz to unlock.
                    </p>
                  ) : null}
                </div>
              </div>
            );

            return (
              <li key={module.id} className="relative">
                {/* Spine connecting the nodes; hidden on the last one. */}
                {!isLast ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-[2.3rem] top-[3.9rem] h-[calc(100%-2.4rem)] w-0.5 rounded",
                      module.completed ? "bg-emerald-400" : "bg-hairline",
                    )}
                  />
                ) : null}

                {locked ? (
                  <div aria-disabled>{node}</div>
                ) : (
                  <Link
                    href={`/tracks/${track.slug}/${module.orderIndex}`}
                    className="block"
                  >
                    {node}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
