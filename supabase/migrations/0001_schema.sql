-- Champio — migration 0001: SCHEMA
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Design notes that matter (full rationale in README):
--   * team_id is denormalised onto proposal_versions and evaluations so that every
--     RLS policy is a single predicate instead of a two-join walk. It is maintained
--     by trigger (inherit_team_id_*), never accepted from the client, so it is a
--     computed column rather than a second source of truth.
--   * quizzes splits questions_json (client-readable) from answer_key_json
--     (column privilege revoked in 0002). RLS is row-level and cannot hide a column,
--     so without the split every student can read the answer key from DevTools.
--   * Rubrics are data. Default rubrics and guidebook-compiled rubrics are the same
--     shape in the same table; only `source` differs, and the evaluation pipeline
--     never reads `source`.

-- ---------------------------------------------------------------- extensions
create extension if not exists pgcrypto;

-- --------------------------------------------------------------------- enums
do $$ begin create type team_role             as enum ('owner','member');                                    exception when duplicate_object then null; end $$;
do $$ begin create type rubric_source         as enum ('default','compiled_from_guidebook');                  exception when duplicate_object then null; end $$;
do $$ begin create type guidebook_status      as enum ('uploaded','compiling','complete','failed');           exception when duplicate_object then null; end $$;
do $$ begin create type evaluation_status     as enum ('queued','extracting','evaluating','complete','failed'); exception when duplicate_object then null; end $$;
do $$ begin create type submission_file_type  as enum ('pdf','pptx');                                        exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------ identity
-- profiles is the per-user record. is_admin gates /admin and is server-assigned
-- only (guarded by trigger in 0002) — a client that can set its own is_admin
-- owns the telemetry dashboard.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  university  text,
  is_admin    boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- Supabase creates the auth.users row; this mirrors it into profiles so the rest
-- of the schema can foreign-key to a table we control.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------- teams
create table if not exists public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  university text,
  created_at timestamptz not null default now()
);

-- The tenancy anchor. Writes are service-role only (see 0002): if a client can
-- insert here it can join any team as owner and every other policy collapses.
create table if not exists public.team_members (
  team_id    uuid not null references public.teams(id)    on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       team_role   not null default 'member',
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on public.team_members(user_id);

-- ------------------------------------------------------------ global content
-- No team_id: these are the same for every tenant. Read by all authenticated
-- users, written only by the service role.
create table if not exists public.tracks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,           -- essay | business_plan | business_case
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists public.learning_modules (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references public.tracks(id) on delete cascade,
  order_index int  not null,                  -- "order" is a reserved word
  title       text not null,
  content_md  text not null default '',
  est_minutes int  not null default 10 check (est_minutes > 0),
  is_draft    boolean not null default true,  -- seeded outlines are DRAFT until replaced
  created_at  timestamptz not null default now(),
  unique (track_id, order_index)
);

create index if not exists learning_modules_track_idx on public.learning_modules(track_id, order_index);

create table if not exists public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null unique references public.learning_modules(id) on delete cascade,
  questions_json  jsonb not null default '[]'::jsonb,  -- prompts + options only
  answer_key_json jsonb not null default '[]'::jsonb,  -- SELECT revoked in 0002
  pass_threshold  int  not null default 70 check (pass_threshold between 0 and 100),
  created_at      timestamptz not null default now()
);

create table if not exists public.reference_papers (
  id               uuid primary key default gen_random_uuid(),
  track_id         uuid references public.tracks(id) on delete set null,
  title            text not null,
  competition_name text,
  year             int check (year between 1990 and 2100),
  summary          text,
  file_path        text not null,             -- reference-papers bucket key
  created_at       timestamptz not null default now()
);

create index if not exists reference_papers_track_idx on public.reference_papers(track_id, year desc);

-- ----------------------------------------------------------- user-owned rows
create table if not exists public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  quiz_id      uuid not null references public.quizzes(id)  on delete cascade,
  score        int  not null check (score between 0 and 100),
  passed       boolean not null,
  answers_json jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id, quiz_id, created_at desc);

-- ------------------------------------------------------------------ rubrics
-- One table, one schema, two producers. team_id null = built-in default rubric
-- visible to everyone; team_id set = compiled from that team's guidebook.
create table if not exists public.rubrics (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams(id)  on delete cascade,
  track_id    uuid not null references public.tracks(id) on delete restrict,
  name        text not null,
  source      rubric_source not null,
  schema_json jsonb not null,                 -- validated by rubricSchema (Zod) before write
  created_at  timestamptz not null default now(),
  -- provenance and ownership must agree
  constraint rubrics_scope_matches_source check (
    (source = 'default'                 and team_id is null) or
    (source = 'compiled_from_guidebook' and team_id is not null)
  )
);

create index if not exists rubrics_team_idx  on public.rubrics(team_id);
create index if not exists rubrics_track_idx on public.rubrics(track_id);

create table if not exists public.guidebooks (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  file_name   text,
  file_path   text not null,                  -- guidebooks bucket key
  status      guidebook_status not null default 'uploaded',
  rubric_id   uuid references public.rubrics(id) on delete set null,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists guidebooks_team_idx on public.guidebooks(team_id, created_at desc);

-- --------------------------------------------------------------- submissions
create table if not exists public.proposals (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id)   on delete cascade,
  track_id   uuid not null references public.tracks(id)  on delete restrict,
  rubric_id  uuid not null references public.rubrics(id) on delete restrict,
  title      text not null check (length(btrim(title)) > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists proposals_team_idx on public.proposals(team_id, created_at desc);

create table if not exists public.proposal_versions (
  id             uuid primary key default gen_random_uuid(),
  proposal_id    uuid not null references public.proposals(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,  -- trigger-maintained
  version_number int  not null check (version_number > 0),
  file_path      text not null,               -- proposals bucket key
  file_type      submission_file_type not null,
  extracted_text text,                        -- page/slide-marked text, filled by pipeline
  extracted_meta jsonb not null default '{}'::jsonb,  -- {page_count, slide_count, ...}
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (proposal_id, version_number)
);

create index if not exists proposal_versions_team_idx     on public.proposal_versions(team_id);
create index if not exists proposal_versions_proposal_idx on public.proposal_versions(proposal_id, version_number);

-- The job queue *is* this table: status carries the pipeline state machine and
-- the sweeper re-drives rows stuck in a non-terminal state.
create table if not exists public.evaluations (
  id                   uuid primary key default gen_random_uuid(),
  proposal_version_id  uuid not null references public.proposal_versions(id) on delete cascade,
  team_id              uuid not null references public.teams(id) on delete cascade,  -- trigger-maintained
  rubric_id            uuid not null references public.rubrics(id) on delete restrict,
  status               evaluation_status not null default 'queued',
  started_at           timestamptz,
  completed_at         timestamptz,
  overall_score        numeric(5,2) check (overall_score between 0 and 100),
  result_json          jsonb,                 -- validated by evaluationResultSchema before write
  token_input          int     not null default 0,
  token_output         int     not null default 0,
  cost_usd             numeric(10,6) not null default 0,
  error                text,
  prompt_version       text,                  -- traceability across prompt iterations
  attempt_count        int     not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists evaluations_team_idx    on public.evaluations(team_id, created_at desc);
create index if not exists evaluations_version_idx on public.evaluations(proposal_version_id, created_at desc);
-- Partial index: the sweeper only ever scans non-terminal rows.
create index if not exists evaluations_pending_idx on public.evaluations(status, created_at)
  where status in ('queued','extracting','evaluating');

-- ----------------------------------------------- team_id inheritance triggers
-- team_id is derived from the parent row, never trusted from the client. This is
-- what makes the denormalisation safe.
create or replace function public.inherit_team_id_from_proposal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.team_id into new.team_id from public.proposals p where p.id = new.proposal_id;
  if new.team_id is null then
    raise exception 'parent proposal % not found', new.proposal_id;
  end if;
  return new;
end $$;

drop trigger if exists proposal_versions_inherit_team on public.proposal_versions;
create trigger proposal_versions_inherit_team
  before insert or update of proposal_id on public.proposal_versions
  for each row execute function public.inherit_team_id_from_proposal();

create or replace function public.inherit_team_id_from_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select v.team_id into new.team_id
    from public.proposal_versions v where v.id = new.proposal_version_id;
  if new.team_id is null then
    raise exception 'parent proposal_version % not found', new.proposal_version_id;
  end if;
  return new;
end $$;

drop trigger if exists evaluations_inherit_team on public.evaluations;
create trigger evaluations_inherit_team
  before insert or update of proposal_version_id on public.evaluations
  for each row execute function public.inherit_team_id_from_version();

-- ------------------------------------------------------- competition results
-- Powers the "report your result" form and the outcome column of /admin.
create table if not exists public.competition_results (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references public.teams(id) on delete cascade,
  proposal_id      uuid references public.proposals(id) on delete set null,
  competition_name text not null,
  stage_reached    text,                      -- e.g. 'semifinal'
  placement        text,                      -- e.g. '2nd place'
  reported_by      uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists competition_results_team_idx on public.competition_results(team_id, created_at desc);

-- ------------------------------------------------------------------- events
-- First-party telemetry. Written by the service role only, so user_id/team_id
-- and event_name cannot be forged by a client. bigint identity: this is the
-- highest-volume table in the system.
create table if not exists public.events (
  id              bigint generated always as identity primary key,
  user_id         uuid references public.profiles(id) on delete set null,
  team_id         uuid references public.teams(id)    on delete set null,
  event_name      text not null,
  properties_json jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists events_name_time_idx on public.events(event_name, created_at desc);
create index if not exists events_team_time_idx on public.events(team_id, created_at desc);
create index if not exists events_user_time_idx on public.events(user_id, created_at desc);

-- Realtime: the client subscribes to its own evaluation rows to follow the
-- pipeline state machine. Realtime respects the SELECT policy from 0002.
do $$ begin
  alter publication supabase_realtime add table public.evaluations;
exception when duplicate_object then null;
end $$;
