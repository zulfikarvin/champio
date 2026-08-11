"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { submitQuizAction } from "@/app/(app)/tracks/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { QuizQuestion, QuizResult } from "@/lib/schemas/quiz";

/**
 * Module quiz.
 *
 * The component never sees the answers. It posts the selected option indices and
 * receives a graded result — the key itself is unreadable from the browser by
 * column privilege, so there is nothing here to inspect in the network tab.
 */
export function Quiz({
  quizId,
  questions,
  passThreshold,
  alreadyPassed,
  nextHref,
}: {
  quizId: string;
  questions: QuizQuestion[];
  passThreshold: number;
  alreadyPassed: boolean;
  nextHref: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  const gradedById = new Map((result?.graded ?? []).map((g) => [g.id, g]));

  function submit() {
    setError(null);
    startTransition(async () => {
      const submission = questions.map((q) => ({
        id: q.id,
        selected_index: answers[q.id],
      }));

      const state = await submitQuizAction(quizId, submission);
      if (state.status === "error") {
        setError(state.message);
        return;
      }
      if (state.status === "graded") {
        setResult(state.result);
        // Refresh so the skill tree and progress bar reflect the new attempt.
        router.refresh();
      }
    });
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setError(null);
  }

  return (
    <section className="card mt-10 p-6 sm:p-8">
      <header className="mb-6">
        <h2 className="text-lg font-bold text-primary">Check your understanding</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {questions.length} questions · {passThreshold}% to pass
          {alreadyPassed && !result ? " · already passed" : ""}
        </p>
      </header>

      <ol className="flex flex-col gap-6">
        {questions.map((question, questionIndex) => {
          const graded = gradedById.get(question.id);

          return (
            <li key={question.id}>
              <fieldset disabled={pending || result !== null}>
                <legend className="mb-3 font-semibold text-ink">
                  {questionIndex + 1}. {question.question}
                </legend>

                <div className="flex flex-col gap-2">
                  {question.options.map((option, optionIndex) => {
                    const selected = answers[question.id] === optionIndex;
                    const isCorrect = graded?.correctIndex === optionIndex;
                    const isWrongPick =
                      graded && graded.selectedIndex === optionIndex && !graded.correct;

                    return (
                      <label
                        key={optionIndex}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-2.5 text-sm transition-colors",
                          !graded && selected
                            ? "border-accent bg-violet-100 font-semibold text-primary"
                            : !graded
                              ? "border-hairline bg-surface text-ink hover:border-accent-light"
                              : "",
                          graded && isCorrect
                            ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-800"
                            : "",
                          graded && isWrongPick
                            ? "border-red-400 bg-red-50 text-red-800"
                            : "",
                          graded && !isCorrect && !isWrongPick
                            ? "border-hairline bg-surface text-ink-muted"
                            : "",
                          result !== null && "cursor-default",
                        )}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          checked={selected}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: optionIndex,
                            }))
                          }
                          className="mt-0.5 size-4 shrink-0 accent-[#7b2cbf]"
                        />
                        <span className="min-w-0">{option}</span>
                        {graded && isCorrect ? (
                          <Check className="ml-auto mt-0.5 size-4 shrink-0 text-emerald-600" />
                        ) : null}
                        {graded && isWrongPick ? (
                          <X className="ml-auto mt-0.5 size-4 shrink-0 text-red-600" />
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {graded ? (
                <p className="mt-2 rounded-[12px] bg-violet-100/60 px-3 py-2 text-sm leading-relaxed text-secondary-dark">
                  {graded.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-[12px] bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-8 border-t border-hairline pt-6">
          <div
            className={cn(
              "rounded-[16px] p-5",
              result.passed ? "bg-emerald-50" : "bg-amber-50",
            )}
          >
            <p
              className={cn(
                "text-2xl font-extrabold tabular-nums",
                result.passed ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {result.score}%
            </p>
            <p
              className={cn(
                "mt-1 text-sm font-semibold",
                result.passed ? "text-emerald-800" : "text-amber-800",
              )}
            >
              {result.passed
                ? "Passed — the next module is unlocked."
                : `You need ${passThreshold}% to unlock the next module. Read the explanations and try again.`}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={retry}>
              <RotateCcw />
              Try again
            </Button>
            {result.passed && nextHref ? (
              <Button type="button" onClick={() => router.push(nextHref)}>
                Next module
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-hairline pt-6">
          <Button type="button" onClick={submit} disabled={!allAnswered || pending}>
            {pending ? "Checking…" : "Submit answers"}
          </Button>
          {!allAnswered ? (
            <span className="text-sm text-ink-muted">
              {answeredCount} of {questions.length} answered
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}
