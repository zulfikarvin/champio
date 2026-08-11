"use server";

import { revalidatePath } from "next/cache";
import type { QuizState } from "@/app/(app)/tracks/quiz-state";
import { logEvent } from "@/lib/events";
import {
  gradeQuiz,
  quizAnswerKeySchema,
  quizSubmissionSchema,
  type QuizSubmission,
} from "@/lib/schemas/quiz";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveTeam } from "@/lib/teams";

/**
 * Grades a quiz and records the attempt.
 *
 * Both halves of this run under the service role, for the same reason:
 *
 *   - Reading `answer_key_json` is impossible from a user-scoped client. Its
 *     SELECT privilege is revoked (migration 0002), which is what stops a student
 *     reading the answers out of the network tab.
 *   - `quiz_attempts` has no client INSERT policy, so a browser cannot post
 *     itself a score of 100. Every attempt on the admin dashboard is one this
 *     function computed.
 *
 * The score is therefore never accepted from the client — only the selected
 * option indices are, and those are validated before use.
 */
export async function submitQuizAction(
  quizId: string,
  submission: QuizSubmission,
): Promise<QuizState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = quizSubmissionSchema.safeParse(submission);
  if (!parsed.success) {
    return { status: "error", message: "That submission was not valid." };
  }

  // Confirm the quiz is visible to this user through RLS before touching it with
  // the service role — otherwise the admin client would happily grade any quiz id.
  const supabase = await createClient();
  const { data: visible } = await supabase
    .from("quizzes")
    .select("id, module_id, pass_threshold")
    .eq("id", quizId)
    .maybeSingle();

  if (!visible) return { status: "error", message: "Quiz not found." };

  const admin = createAdminClient();
  const { data: quiz, error } = await admin
    .from("quizzes")
    .select("id, module_id, pass_threshold, answer_key_json")
    .eq("id", quizId)
    .single();

  if (error || !quiz) {
    console.error("[quiz] failed to load answer key:", error?.message);
    return { status: "error", message: "Could not grade this quiz." };
  }

  const answerKey = quizAnswerKeySchema.safeParse(quiz.answer_key_json);
  if (!answerKey.success) {
    console.error("[quiz] malformed answer key for", quizId);
    return { status: "error", message: "This quiz is misconfigured." };
  }

  const result = gradeQuiz(answerKey.data, parsed.data, quiz.pass_threshold);

  const { error: attemptError } = await admin.from("quiz_attempts").insert({
    user_id: user.id,
    quiz_id: quiz.id,
    score: result.score,
    passed: result.passed,
    answers_json: parsed.data,
  });

  if (attemptError) {
    console.error("[quiz] failed to record attempt:", attemptError.message);
    return { status: "error", message: "Could not save your attempt." };
  }

  const team = await getActiveTeam();

  if (result.passed) {
    // Passing the quiz is what marks a module complete and unlocks the next one,
    // so both events fire together rather than being inferred later.
    await logEvent({
      name: "quiz_passed",
      userId: user.id,
      teamId: team?.teamId ?? null,
      properties: { quiz_id: quiz.id, module_id: quiz.module_id, score: result.score },
    });
    await logEvent({
      name: "module_completed",
      userId: user.id,
      teamId: team?.teamId ?? null,
      properties: { module_id: quiz.module_id, score: result.score },
    });
  }

  revalidatePath("/tracks", "layout");
  return { status: "graded", result };
}
