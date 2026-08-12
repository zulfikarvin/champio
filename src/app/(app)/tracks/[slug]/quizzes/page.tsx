import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Target } from "lucide-react";
import { cn } from "@/lib/cn";
import { getTrack, listTrackQuizzes } from "@/lib/learning";

export const metadata: Metadata = { title: "Test my Knowledge" };

export default async function TrackQuizzesPage({
  params,
}: PageProps<"/tracks/[slug]/quizzes">) {
  const { slug } = await params;

  const [track, quizzes] = await Promise.all([getTrack(slug), listTrackQuizzes(slug)]);
  if (!track) notFound();

  const passed = quizzes.filter((q) => q.passed).length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/tracks/${slug}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        {track.name}
      </Link>

      <header className="mb-8">
        <span className="inline-flex size-11 items-center justify-center rounded-[14px] bg-violet-100">
          <Target className="size-5 text-accent" />
        </span>
        <h1 className="display-lg mt-4 text-primary">Test my Knowledge!</h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-muted">
          One quiz per article. Take them in any order, as many times as you like
          — nothing here blocks your reading. They exist to find the gaps before a
          judge does.
        </p>

        {quizzes.length > 0 ? (
          <div className="mt-5 flex items-center gap-3">
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-canvas"
              role="img"
              aria-label={`${passed} of ${quizzes.length} passed`}
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${(passed / quizzes.length) * 100}%` }}
              />
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
              {passed}/{quizzes.length} passed
            </span>
          </div>
        ) : null}
      </header>

      {quizzes.length === 0 ? (
        <div className="card p-8">
          <h2 className="text-lg font-bold text-primary">No quizzes yet</h2>
          <p className="mt-2 text-sm text-ink-muted">
            This track has no quizzes yet.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {quizzes.map((quiz) => (
            <li key={quiz.quizId}>
              <Link
                href={`/tracks/${slug}/quizzes/${quiz.moduleOrderIndex}`}
                className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-[0_12px_24px_-10px_rgba(16,0,43,0.12)]"
              >
                <span
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    quiz.passed
                      ? "bg-emerald-500 text-white"
                      : "bg-violet-100 text-secondary",
                  )}
                >
                  {quiz.passed ? (
                    <Check className="size-4.5" />
                  ) : (
                    quiz.moduleOrderIndex
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-bold text-primary">
                    {quiz.moduleTitle}
                  </h2>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-muted">
                    <span>
                      {quiz.questionCount} questions · {quiz.passThreshold}% to
                      pass
                    </span>
                    {quiz.bestScore !== null ? (
                      <span
                        className={cn(
                          "font-semibold",
                          quiz.passed ? "text-emerald-600" : "text-amber-600",
                        )}
                      >
                        Best {quiz.bestScore}%
                        {quiz.attempts > 1 ? ` · ${quiz.attempts} attempts` : ""}
                      </span>
                    ) : (
                      <span>Not attempted</span>
                    )}
                  </p>
                </div>

                <ArrowRight className="size-4 shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
