import { z } from "zod";

/**
 * Quiz contracts.
 *
 * Questions and answers live in two separate columns for a reason: `quizzes`
 * splits `questions_json` (client-readable) from `answer_key_json`, whose SELECT
 * privilege is revoked from `anon` and `authenticated` in migration 0002. RLS is
 * row-level and cannot hide a column, so without that split every student could
 * read the correct answers straight out of DevTools.
 *
 * These two schemas mirror that boundary: `quizQuestionsSchema` is what a browser
 * is allowed to see, `quizAnswerKeySchema` is what only the service role reads
 * while scoring.
 */

export const quizQuestionSchema = z.object({
  /** Stable id joining a question to its answer and to a submitted response. */
  id: z.string().min(1).max(64),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(6),
});

export const quizQuestionsSchema = z.array(quizQuestionSchema).min(1).max(30);

export const quizAnswerSchema = z.object({
  id: z.string().min(1).max(64),
  /** Index into the matching question's `options`. */
  correct_index: z.number().int().min(0),
  /** Shown after submission — the teaching moment is the explanation, not the score. */
  explanation: z.string().min(1),
});

export const quizAnswerKeySchema = z.array(quizAnswerSchema).min(1).max(30);

/** What the browser submits: question id → chosen option index. */
export const quizSubmissionSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(64),
      selected_index: z.number().int().min(0).max(5),
    }),
  )
  .min(1)
  .max(30);

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;
export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;

export type GradedQuestion = {
  id: string;
  selectedIndex: number | null;
  correctIndex: number;
  correct: boolean;
  explanation: string;
};

export type QuizResult = {
  /** Percentage, 0–100, rounded. */
  score: number;
  passed: boolean;
  graded: GradedQuestion[];
};

/**
 * Grades a submission against the answer key.
 *
 * Server-side only in practice — the key is unreadable from a browser. Kept as a
 * pure function so it can be tested without a database, and so the scoring rule
 * lives in one place rather than being reimplemented per call site.
 *
 * Unanswered questions count as wrong rather than being skipped: a student who
 * answers two of five correctly scored 40%, not 100%.
 */
export function gradeQuiz(
  answerKey: QuizAnswer[],
  submission: QuizSubmission,
  passThreshold: number,
): QuizResult {
  const chosen = new Map(submission.map((s) => [s.id, s.selected_index]));

  const graded: GradedQuestion[] = answerKey.map((answer) => {
    const selectedIndex = chosen.get(answer.id) ?? null;
    return {
      id: answer.id,
      selectedIndex,
      correctIndex: answer.correct_index,
      correct: selectedIndex === answer.correct_index,
      explanation: answer.explanation,
    };
  });

  const correctCount = graded.filter((g) => g.correct).length;
  const score = Math.round((correctCount / graded.length) * 100);

  return { score, passed: score >= passThreshold, graded };
}
