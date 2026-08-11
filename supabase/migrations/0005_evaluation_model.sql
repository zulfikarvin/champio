-- Champio — migration 0005: record the model that produced each evaluation
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Why this exists:
--   The product's core claim is that a v1 score and a v2 score are comparable.
--   `prompt_version` already guards against a prompt edit silently invalidating
--   that comparison — but a *model* change breaks it in exactly the same way, and
--   was not being recorded. Two scores from different models are no more
--   comparable than two scores from different prompts.
--
--   This became concrete rather than theoretical when gemini-2.5-pro stopped
--   being available to new API keys mid-build and the pipeline had to move to
--   gemini-3.1-pro-preview. Without this column there would be no way to tell,
--   later, which rows were scored by which.
--
-- Existing rows are left null: they were produced by the seed script, not by a
-- real model run, and backfilling a guess would be worse than an honest null.

alter table public.evaluations
  add column if not exists model text;

comment on column public.evaluations.model is
  'Pinned model id that produced this evaluation (e.g. gemini-3.1-pro-preview). '
  'Null for seeded/demo rows. Together with prompt_version, this is what makes a '
  'v1-vs-v2 score comparison defensible.';

-- The admin dashboard groups cost and latency by model; this keeps that cheap.
create index if not exists evaluations_model_idx
  on public.evaluations(model, created_at desc)
  where model is not null;
