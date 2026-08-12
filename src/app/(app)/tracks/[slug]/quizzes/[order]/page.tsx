import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Quiz } from "@/app/(app)/tracks/[slug]/quizzes/[order]/quiz";
import { getTrackQuiz } from "@/lib/learning";

export const metadata: Metadata = { title: "Quiz" };

export default async function QuizPage({
  params,
}: PageProps<"/tracks/[slug]/quizzes/[order]">) {
  const { slug, order } = await params;

  const orderIndex = Number(order);
  if (!Number.isInteger(orderIndex) || orderIndex < 1) notFound();

  const quiz = await getTrackQuiz(slug, orderIndex);
  if (!quiz) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={`/tracks/${slug}/quizzes`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-4" />
        Test my Knowledge
      </Link>

      <header className="mb-6">
        <p className="text-sm font-semibold text-accent">
          Quiz {quiz.moduleOrderIndex}
        </p>
        <h1 className="display-lg mt-1 text-primary">{quiz.moduleTitle}</h1>

        <Link
          href={`/tracks/${slug}/${quiz.moduleOrderIndex}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
        >
          <BookOpen className="size-4" />
          Read the article first
        </Link>
      </header>

      <Quiz
        quizId={quiz.quizId}
        questions={quiz.questions}
        passThreshold={quiz.passThreshold}
        alreadyPassed={quiz.passed}
        bestScore={quiz.bestScore}
        quizzesHref={`/tracks/${slug}/quizzes`}
      />
    </div>
  );
}
