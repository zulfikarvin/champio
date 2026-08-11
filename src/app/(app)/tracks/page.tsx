import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { listTracks } from "@/lib/learning";

export const metadata: Metadata = { title: "Learning Tracks" };

export default async function TracksPage() {
  const tracks = await listTracks();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-8">
        <h1 className="display-lg text-primary">Learning Tracks</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Work through a track module by module. Each quiz unlocks the next step.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {tracks.map((track) => {
          const started = track.completedCount > 0;
          const done =
            track.moduleCount > 0 && track.completedCount === track.moduleCount;

          return (
            <Link
              key={track.id}
              href={`/tracks/${track.slug}`}
              className="card group flex flex-col p-6 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-violet-100">
                  {done ? (
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  ) : (
                    <BookOpen className="size-5 text-accent" />
                  )}
                </span>
                {track.moduleCount > 0 ? (
                  <span className="text-xs font-semibold text-ink-muted">
                    {track.completedCount}/{track.moduleCount}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-4 text-lg font-bold text-primary">{track.name}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-ink-muted">
                {track.description}
              </p>

              {track.moduleCount === 0 ? (
                <p className="mt-4 text-xs font-semibold text-ink-muted">
                  Content coming soon
                </p>
              ) : (
                <>
                  <div
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas"
                    role="img"
                    aria-label={`${track.progressPercent}% complete`}
                  >
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${track.progressPercent}%` }}
                    />
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                    {started ? "Continue" : "Start track"}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
