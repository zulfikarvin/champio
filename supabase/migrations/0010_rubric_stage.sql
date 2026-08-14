-- Champio — migration 0010: a guidebook produces one rubric per assessment stage
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Real guidebooks score more than one thing. A typical Indonesian BPC guidebook
-- has two separate tables:
--
--   Penilaian Proposal        Penilaian Presentasi
--     Kreativitas         30%   Kesesuaian dengan Proposal    30%
--     BMC & Kelayakan     30%   Kejelasan dan Struktur        25%
--     Analisis Pasar      20%   Kemampuan Menjawab Pertanyaan 25%
--     Analisis Keuangan   20%   Penampilan dan Komunikasi     20%
--
-- Compiled as one rubric, those eight criteria sum to 200%, get normalised to
-- 100%, and a written proposal ends up scored partly on "Penampilan dan
-- Komunikasi" — delivery criteria applied to a document nobody delivers. The
-- weights are wrong too: Kreativitas should carry 30% of the proposal score, not
-- 15% of a merged one.
--
-- So a guidebook now compiles into one rubric PER STAGE, and an evaluation uses
-- the stage that matches what is being assessed.
--
-- `stage` is text with a check rather than an enum: competitions also run
-- prototype rounds, pitch days and interviews, and extending a check constraint
-- is a one-line migration where extending an enum is not.

alter table public.rubrics
  add column if not exists stage text not null default 'proposal';

do $$ begin
  alter table public.rubrics
    add constraint rubrics_stage_known
    check (stage in ('proposal', 'presentation', 'prototype', 'other'));
exception when duplicate_object then null;
end $$;

comment on column public.rubrics.stage is
  'Which assessment this rubric scores: proposal (the written document), '
  'presentation (the pitch), prototype, or other. A guidebook with several '
  'assessment tables compiles into one rubric per stage.';

-- Which guidebook a compiled rubric came from. Null for the three built-in
-- rubrics, which have no source document.
alter table public.rubrics
  add column if not exists guidebook_id uuid references public.guidebooks(id) on delete cascade;

create index if not exists rubrics_guidebook_idx
  on public.rubrics(guidebook_id) where guidebook_id is not null;

-- One rubric per stage per guidebook. Two "proposal" rubrics from the same
-- document would leave it ambiguous which one scores a version.
create unique index if not exists rubrics_one_per_stage_per_guidebook
  on public.rubrics(guidebook_id, stage) where guidebook_id is not null;

-- Existing rows: the three seeded defaults, plus anything compiled before this
-- migration. All of them score the written document, which is the column default,
-- so no backfill is needed — this is stated rather than run so the intent is on
-- the record.

-- One default rubric per track *per stage* now, replacing the index from 0004.
drop index if exists public.rubrics_one_default_per_track;
create unique index if not exists rubrics_one_default_per_track_stage
  on public.rubrics(track_id, stage) where source = 'default';

-- Drafts compiled before this migration hold a single flattened rubric, not the
-- per-stage shape the app now reads. An unreviewed draft in the old shape cannot
-- be displayed or saved, so it is marked failed with an explanation — that puts a
-- "Try again" button in front of the user, which recompiles with the new prompt.
--
-- Guidebooks whose rubric was already SAVED are left alone: the rubrics row is
-- the source of truth at that point, compiled_json is only the draft that
-- produced it, and the saved rubric scores the written proposal either way.
update public.guidebooks
   set status = 'failed',
       compiled_json = null,
       error = 'Recompile needed: this guidebook was read before Champio '
               'separated proposal and presentation criteria, so its draft '
               'merged them into one rubric.'
 where rubric_id is null
   and compiled_json is not null
   and not (compiled_json ? 'staged');
