import type { QuizResult } from "@/lib/schemas/quiz";

/**
 * Quiz submission result shape. Separate from `actions.ts` because a
 * `"use server"` module may only export async functions.
 */
export type QuizState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "graded"; result: QuizResult };

export const initialQuizState: QuizState = { status: "idle" };
