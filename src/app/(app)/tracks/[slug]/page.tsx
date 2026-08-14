import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock, Target } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { getTrack } from "@/lib/learning";

export const metadata: Metadata = { title: "Track" };

export default async function TrackPage({ params }: PageProps<"/tracks/[slug]">) {
  const { slug } = await params;
  const track = await getTrack(slug, await getLocale());
  if (!track) notFound();

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
          <p className="mt-3 text-xs text-ink-muted">
            {track.modules.length} articles · {track.totalMinutes} min total
          </p>
        ) : null}
      </header>

      {track.modules.length === 0 ? (
        <div className="card p-8">
          <h2 className="text-lg font-bold text-primary">No articles yet</h2>
          <p className="mt-2 text-sm text-ink-muted">
            This track has no content yet. The Business Plan track is the one
            currently built out.
          </p>
        </div>
      ) : (
        <>
          {/* Articles. Every one is open — this is reference material a team dips
              into mid-competition, not a course you have to unlock. */}
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-muted">
              <BookOpen className="size-3.5" />
              Articles
            </h2>

            <ol className="flex flex-col gap-3">
              {track.modules.map((module) => (
                <li key={module.id}>
                  <Link
                    href={`/tracks/${track.slug}/${module.orderIndex}`}
                    className="card flex items-start gap-4 p-5 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
                  >
                    <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-secondary">
                      {module.orderIndex}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-primary">{module.title}</h3>
                        {module.isDraft ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            DRAFT
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                        <Clock className="size-3.5" />
                        {module.estMinutes} min read
                      </p>
                    </div>

                    <ArrowRight className="mt-2 size-4 shrink-0 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          {/* Self-check, deliberately separate. Nothing here blocks reading. */}
          {track.quizCount > 0 ? (
            <section>
              <Link
                href={`/tracks/${track.slug}/quizzes`}
                className="group block rounded-[20px] bg-primary p-6 transition-shadow hover:shadow-[0_12px_28px_-10px_rgba(16,0,43,0.45)] sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-white/10">
                    <Target className="size-5 text-violet-200" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold text-white">
                      Test my Knowledge!
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-violet-200">
                      {track.quizCount} short quizzes, one per article. Optional —
                      take them in any order to find the gaps before a judge does.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
                        role="img"
                        aria-label={`${track.passedCount} of ${track.quizCount} quizzes passed`}
                      >
                        <div
                          className="h-full rounded-full bg-violet-300 transition-all"
                          style={{ width: `${track.progressPercent}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-violet-200">
                        {track.passedCount}/{track.quizCount}
                      </span>
                    </div>

                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-violet-200">
                      {track.passedCount > 0 ? "Continue testing" : "Start testing"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>

                  {track.passedCount === track.quizCount ? (
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                      <Check className="size-4 text-white" />
                    </span>
                  ) : null}
                </div>
              </Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
