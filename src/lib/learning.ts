import "server-only";

import { createClient } from "@/lib/supabase/server";
import { quizQuestionsSchema, type QuizQuestion } from "@/lib/schemas/quiz";

/**
 * Learning tracks, modules and per-user progress.
 *
 * Two things to know before reading queries here:
 *
 * 1. **Never `select("*")` from `quizzes`.** Migration 0002 revokes SELECT on
 *    `answer_key_json` from anon/authenticated, so a star select ERRORS rather
 *    than quietly omitting the column. That is the intended failure mode — but it
 *    means every query must name its columns.
 *
 * 2. **Progress is derived, not stored.** A module is complete when its quiz has a
 *    passing attempt, and module N unlocks when N−1 is complete. Keeping this as a
 *    computed view of `quiz_attempts` means there is no progress record that can
 *    drift out of sync with the attempts that produced it.
 */

/** Modules are gated on the previous module's quiz being passed. */
export type ModuleSummary = {
  id: string;
  orderIndex: number;
  title: string;
  estMinutes: number;
  isDraft: boolean;
  hasQuiz: boolean;
  completed: boolean;
  unlocked: boolean;
  /** Best score across attempts, or null if never attempted. */
  bestScore: number | null;
  attempts: number;
};

export type TrackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  moduleCount: number;
  completedCount: number;
  /** 0–100. */
  progressPercent: number;
};

type AttemptRow = { quiz_id: string; score: number; passed: boolean };

/** quiz_id → { best, passed, attempts } for the signed-in user. */
async function loadAttempts(): Promise<
  Map<string, { best: number; passed: boolean; attempts: number }>
> {
  const supabase = await createClient();

  // RLS restricts this to the caller's own attempts, so no user filter is needed
  // for correctness — the policy is the filter.
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("quiz_id, score, passed");

  if (error) throw new Error(`failed to load quiz attempts: ${error.message}`);

  const byQuiz = new Map<string, { best: number; passed: boolean; attempts: number }>();
  for (const row of (data ?? []) as AttemptRow[]) {
    const current = byQuiz.get(row.quiz_id);
    byQuiz.set(row.quiz_id, {
      best: Math.max(current?.best ?? 0, row.score),
      passed: (current?.passed ?? false) || row.passed,
      attempts: (current?.attempts ?? 0) + 1,
    });
  }
  return byQuiz;
}

export async function listTracks(): Promise<TrackSummary[]> {
  const supabase = await createClient();

  const [{ data: tracks, error }, attempts] = await Promise.all([
    supabase
      .from("tracks")
      .select("id, slug, name, description, learning_modules(id, quizzes(id))")
      .order("name"),
    loadAttempts(),
  ]);

  if (error) throw new Error(`failed to list tracks: ${error.message}`);

  return (tracks ?? []).map((track) => {
    const trackModules = track.learning_modules ?? [];
    // `quizzes` is a to-one embed: quizzes.module_id is unique, so PostgREST
    // returns an object rather than an array.
    const completedCount = trackModules.filter((item) => {
      const quiz = item.quizzes;
      return quiz ? (attempts.get(quiz.id)?.passed ?? false) : false;
    }).length;

    return {
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      moduleCount: trackModules.length,
      completedCount,
      progressPercent:
        trackModules.length === 0
          ? 0
          : Math.round((completedCount / trackModules.length) * 100),
    };
  });
}

export type TrackDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  modules: ModuleSummary[];
  completedCount: number;
  progressPercent: number;
};

export async function getTrack(slug: string): Promise<TrackDetail | null> {
  const supabase = await createClient();

  const [{ data: track, error }, attempts] = await Promise.all([
    supabase
      .from("tracks")
      .select(
        `id, slug, name, description,
         learning_modules(id, order_index, title, est_minutes, is_draft, quizzes(id))`,
      )
      .eq("slug", slug)
      .maybeSingle(),
    loadAttempts(),
  ]);

  if (error) throw new Error(`failed to load track: ${error.message}`);
  if (!track) return null;

  const ordered = [...(track.learning_modules ?? [])].sort(
    (a, b) => a.order_index - b.order_index,
  );

  const modules: ModuleSummary[] = [];
  let previousCompleted = true; // the first module is always available

  for (const item of ordered) {
    const quiz = item.quizzes;
    const attempt = quiz ? attempts.get(quiz.id) : undefined;
    // A module with no quiz cannot be "completed" and would otherwise block the
    // whole track, so it passes the gate through rather than closing it.
    const completed = quiz ? (attempt?.passed ?? false) : false;

    modules.push({
      id: item.id,
      orderIndex: item.order_index,
      title: item.title,
      estMinutes: item.est_minutes,
      isDraft: item.is_draft,
      hasQuiz: Boolean(quiz),
      completed,
      unlocked: previousCompleted,
      bestScore: attempt?.best ?? null,
      attempts: attempt?.attempts ?? 0,
    });

    previousCompleted = quiz ? completed : true;
  }

  const completedCount = modules.filter((m) => m.completed).length;

  return {
    id: track.id,
    slug: track.slug,
    name: track.name,
    description: track.description,
    modules,
    completedCount,
    progressPercent:
      modules.length === 0 ? 0 : Math.round((completedCount / modules.length) * 100),
  };
}

export type ModuleDetail = {
  id: string;
  orderIndex: number;
  title: string;
  contentMd: string;
  estMinutes: number;
  isDraft: boolean;
  trackName: string;
  trackSlug: string;
  /** Null when the module has no quiz. */
  quiz: {
    id: string;
    passThreshold: number;
    questions: QuizQuestion[];
  } | null;
  completed: boolean;
  bestScore: number | null;
  unlocked: boolean;
  previousTitle: string | null;
  nextOrderIndex: number | null;
};

export async function getModule(
  slug: string,
  orderIndex: number,
): Promise<ModuleDetail | null> {
  const track = await getTrack(slug);
  if (!track) return null;

  const summary = track.modules.find((m) => m.orderIndex === orderIndex);
  if (!summary) return null;

  const supabase = await createClient();

  // Explicit column list: `select("*")` on quizzes errors because answer_key_json
  // is revoked. That is deliberate — see the note at the top of this file.
  const { data: row, error } = await supabase
    .from("learning_modules")
    .select(
      "id, order_index, title, content_md, est_minutes, is_draft, quizzes(id, pass_threshold, questions_json)",
    )
    .eq("id", summary.id)
    .maybeSingle();

  if (error) throw new Error(`failed to load module: ${error.message}`);
  if (!row) return null;

  const quizRow = row.quizzes;
  const index = track.modules.findIndex((m) => m.orderIndex === orderIndex);
  const next = track.modules[index + 1];

  return {
    id: row.id,
    orderIndex: row.order_index,
    title: row.title,
    contentMd: row.content_md,
    estMinutes: row.est_minutes,
    isDraft: row.is_draft,
    trackName: track.name,
    trackSlug: track.slug,
    quiz: quizRow
      ? {
          id: quizRow.id,
          passThreshold: quizRow.pass_threshold,
          // Parsed rather than cast: a malformed seed should fail here with a
          // clear error, not render a quiz with missing options.
          questions: quizQuestionsSchema.parse(quizRow.questions_json),
        }
      : null,
    completed: summary.completed,
    bestScore: summary.bestScore,
    unlocked: summary.unlocked,
    previousTitle: index > 0 ? track.modules[index - 1].title : null,
    nextOrderIndex: next ? next.orderIndex : null,
  };
}
