import "server-only";

import { createClient } from "@/lib/supabase/server";
import { quizQuestionsSchema, type QuizQuestion } from "@/lib/schemas/quiz";

/**
 * Learning tracks, modules and quizzes.
 *
 * Three things to know before reading queries here:
 *
 * 1. **Never `select("*")` from `quizzes`.** Migration 0002 revokes SELECT on
 *    `answer_key_json` from anon/authenticated, so a star select ERRORS rather
 *    than quietly omitting the column. That is the intended failure mode — but it
 *    means every query must name its columns.
 *
 * 2. **Modules are not gated.** Every module in a track is readable at any time.
 *    An earlier version unlocked module N only once N−1's quiz was passed; that
 *    turned reference material into something you had to earn, which is the wrong
 *    shape for content a team dips into mid-competition. Quizzes are now a
 *    separate, optional self-check.
 *
 * 3. **Progress is derived, not stored.** It reflects quizzes passed, computed
 *    from `quiz_attempts`, so there is no progress record that can drift out of
 *    sync with the attempts that produced it. It measures self-testing, not
 *    reading — nothing tracks whether an article was actually read.
 */

export type ModuleSummary = {
  id: string;
  orderIndex: number;
  title: string;
  estMinutes: number;
  isDraft: boolean;
  hasQuiz: boolean;
  /** Whether this module's quiz has been passed. Does not gate anything. */
  quizPassed: boolean;
  bestScore: number | null;
  attempts: number;
};

export type TrackSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  moduleCount: number;
  quizCount: number;
  passedCount: number;
  /** 0–100, over quizzes passed. */
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
    const quizzes = trackModules.map((item) => item.quizzes).filter((q) => q !== null);
    const passedCount = quizzes.filter(
      (quiz) => attempts.get(quiz.id)?.passed ?? false,
    ).length;

    return {
      id: track.id,
      slug: track.slug,
      name: track.name,
      description: track.description,
      moduleCount: trackModules.length,
      quizCount: quizzes.length,
      passedCount,
      progressPercent:
        quizzes.length === 0 ? 0 : Math.round((passedCount / quizzes.length) * 100),
    };
  });
}

export type TrackDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  modules: ModuleSummary[];
  quizCount: number;
  passedCount: number;
  progressPercent: number;
  totalMinutes: number;
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

  const modules: ModuleSummary[] = [...(track.learning_modules ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .map((item) => {
      const quiz = item.quizzes;
      const attempt = quiz ? attempts.get(quiz.id) : undefined;

      return {
        id: item.id,
        orderIndex: item.order_index,
        title: item.title,
        estMinutes: item.est_minutes,
        isDraft: item.is_draft,
        hasQuiz: Boolean(quiz),
        quizPassed: attempt?.passed ?? false,
        bestScore: attempt?.best ?? null,
        attempts: attempt?.attempts ?? 0,
      };
    });

  const withQuiz = modules.filter((m) => m.hasQuiz);
  const passedCount = withQuiz.filter((m) => m.quizPassed).length;

  return {
    id: track.id,
    slug: track.slug,
    name: track.name,
    description: track.description,
    modules,
    quizCount: withQuiz.length,
    passedCount,
    progressPercent:
      withQuiz.length === 0 ? 0 : Math.round((passedCount / withQuiz.length) * 100),
    totalMinutes: modules.reduce((sum, m) => sum + m.estMinutes, 0),
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
  hasQuiz: boolean;
  quizPassed: boolean;
  previousOrderIndex: number | null;
  nextOrderIndex: number | null;
  nextTitle: string | null;
};

/** The article. No quiz — that lives in the track's Test Your Knowledge section. */
export async function getModule(
  slug: string,
  orderIndex: number,
): Promise<ModuleDetail | null> {
  const track = await getTrack(slug);
  if (!track) return null;

  const index = track.modules.findIndex((m) => m.orderIndex === orderIndex);
  if (index === -1) return null;
  const summary = track.modules[index];

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("learning_modules")
    .select("id, order_index, title, content_md, est_minutes, is_draft")
    .eq("id", summary.id)
    .maybeSingle();

  if (error) throw new Error(`failed to load module: ${error.message}`);
  if (!row) return null;

  const previous = track.modules[index - 1];
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
    hasQuiz: summary.hasQuiz,
    quizPassed: summary.quizPassed,
    previousOrderIndex: previous ? previous.orderIndex : null,
    nextOrderIndex: next ? next.orderIndex : null,
    nextTitle: next ? next.title : null,
  };
}

export type QuizSummary = {
  quizId: string;
  moduleOrderIndex: number;
  moduleTitle: string;
  questionCount: number;
  passThreshold: number;
  passed: boolean;
  bestScore: number | null;
  attempts: number;
};

/** Every quiz in a track, for the "Test Your Knowledge" hub. */
export async function listTrackQuizzes(slug: string): Promise<QuizSummary[]> {
  const supabase = await createClient();

  // Explicit column list: `select("*")` on quizzes errors because
  // answer_key_json is revoked. That is deliberate — see the note above.
  const [{ data: track, error }, attempts] = await Promise.all([
    supabase
      .from("tracks")
      .select(
        `id, learning_modules(order_index, title, quizzes(id, pass_threshold, questions_json))`,
      )
      .eq("slug", slug)
      .maybeSingle(),
    loadAttempts(),
  ]);

  if (error) throw new Error(`failed to load quizzes: ${error.message}`);
  if (!track) return [];

  return [...(track.learning_modules ?? [])]
    .sort((a, b) => a.order_index - b.order_index)
    .flatMap((item) => {
      const quiz = item.quizzes;
      if (!quiz) return [];

      const questions = quizQuestionsSchema.safeParse(quiz.questions_json);
      const attempt = attempts.get(quiz.id);

      return [
        {
          quizId: quiz.id,
          moduleOrderIndex: item.order_index,
          moduleTitle: item.title,
          questionCount: questions.success ? questions.data.length : 0,
          passThreshold: quiz.pass_threshold,
          passed: attempt?.passed ?? false,
          bestScore: attempt?.best ?? null,
          attempts: attempt?.attempts ?? 0,
        },
      ];
    });
}

export type QuizDetail = {
  quizId: string;
  trackSlug: string;
  trackName: string;
  moduleOrderIndex: number;
  moduleTitle: string;
  passThreshold: number;
  questions: QuizQuestion[];
  passed: boolean;
  bestScore: number | null;
};

export async function getTrackQuiz(
  slug: string,
  orderIndex: number,
): Promise<QuizDetail | null> {
  const track = await getTrack(slug);
  if (!track) return null;

  const summary = track.modules.find((m) => m.orderIndex === orderIndex);
  if (!summary || !summary.hasQuiz) return null;

  const supabase = await createClient();
  const { data: quiz, error } = await supabase
    .from("quizzes")
    .select("id, pass_threshold, questions_json")
    .eq("module_id", summary.id)
    .maybeSingle();

  if (error) throw new Error(`failed to load quiz: ${error.message}`);
  if (!quiz) return null;

  return {
    quizId: quiz.id,
    trackSlug: track.slug,
    trackName: track.name,
    moduleOrderIndex: summary.orderIndex,
    moduleTitle: summary.title,
    passThreshold: quiz.pass_threshold,
    // Parsed rather than cast: a malformed seed should fail with a clear error,
    // not render a quiz with missing options.
    questions: quizQuestionsSchema.parse(quiz.questions_json),
    passed: summary.quizPassed,
    bestScore: summary.bestScore,
  };
}
