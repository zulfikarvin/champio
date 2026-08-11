-- Champio — migration 0008: hold compiled rubrics for review before saving
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- The Rubric Compiler turns a competition guidebook into a rubric, but the user
-- must be able to see and correct it first — a model reading a PDF will
-- occasionally mislabel a criterion or misread a weight, and an unreviewed rubric
-- would then silently score every submission for that competition.
--
-- So compilation lands here, not in `rubrics`:
--
--   upload → status 'uploaded'
--          → status 'compiling'
--          → status 'complete', compiled_json populated, rubric_id still null
--          → user reviews and edits, then saves
--          → a rubrics row is created and rubric_id points at it
--
-- Keeping the draft out of `rubrics` matters because a rubrics row is immediately
-- selectable when creating a proposal (RLS grants team members read access to
-- their own team's rubrics). A half-checked rubric appearing in that picker is
-- exactly what this column prevents.
--
-- The saved rubric is an ordinary row with source = 'compiled_from_guidebook'.
-- The evaluation pipeline never reads `source`, so nothing downstream changes.

alter table public.guidebooks
  add column if not exists compiled_json jsonb;

comment on column public.guidebooks.compiled_json is
  'Rubric draft produced by the compiler, pending user review. Validated against '
  'rubricSchema before it is written. Cleared conceptually once rubric_id is set — '
  'the saved rubric becomes the source of truth at that point.';

comment on column public.guidebooks.rubric_id is
  'Set only after the user reviews the compiled draft and saves it. Null while a '
  'guidebook is uploaded, compiling, or compiled-but-unreviewed.';
