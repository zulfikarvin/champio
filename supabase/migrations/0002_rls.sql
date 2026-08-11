-- Champio — migration 0002: ROW LEVEL SECURITY
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- The whole model in one sentence: every table is exactly one of
--   global content (read by all authenticated, written by service role),
--   user-owned  (auth.uid() match),
--   team-scoped (is_team_member(team_id)),
--   server-only (no client policy at all).
--
-- Two rules encode the findings from a previous project's pentest:
--   1. The table that anchors tenancy (team_members) is NOT client-writable.
--      If a user can insert themselves into an arbitrary team as owner, every
--      other policy in this file collapses.
--   2. Membership is read through a SECURITY DEFINER function. A policy on
--      team_members that queries team_members recurses infinitely; the definer
--      function bypasses RLS on the inner read and breaks the cycle.
--
-- `set search_path = public` on every definer function is mandatory — a mutable
-- search_path on a SECURITY DEFINER function is a privilege-escalation vector.
--
-- `(select auth.uid())` rather than bare `auth.uid()` lets Postgres hoist it into
-- an InitPlan and evaluate it once per query instead of once per row.

-- ===========================================================================
-- 1. HELPER FUNCTIONS
-- ===========================================================================

create or replace function public.is_team_member(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = (select auth.uid())
  )
$$;

create or replace function public.is_team_owner(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

-- Lets a member see their teammates' profile rows (names in the members list)
-- without exposing every profile in the database.
create or replace function public.shares_team_with(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = u
  )
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

-- A rubric that has already scored something is frozen: a v1-vs-v2 delta compared
-- against two different rubrics is not a comparison. Definer so the check is not
-- itself filtered by the caller's view of evaluations.
create or replace function public.rubric_is_unused(r uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.evaluations where rubric_id = r)
$$;

-- ===========================================================================
-- 2. GUARD TRIGGERS
-- Server-assigned columns that RLS alone cannot protect. RLS WITH CHECK cannot
-- compare NEW against OLD per column, so these are triggers.
-- Under the service role auth.uid() is null — trusted, let it through.
-- ===========================================================================

-- A client that can set its own is_admin owns the telemetry dashboard.
create or replace function public.guard_profile_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' and new.is_admin then
    raise exception 'profiles.is_admin is server-assigned, not client-writable';
  elsif tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    raise exception 'profiles.is_admin is not client-writable';
  end if;

  return new;
end $$;

drop trigger if exists guard_profile_admin_trg on public.profiles;
create trigger guard_profile_admin_trg
  before insert or update on public.profiles
  for each row execute function public.guard_profile_admin();

-- Membership is assigned by the server (createTeam / acceptInvite), never by the
-- client. There is deliberately no INSERT or UPDATE policy on team_members; this
-- trigger is the second wall behind that.
create or replace function public.guard_team_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  raise exception 'team_members is server-assigned, not client-writable';
end $$;

drop trigger if exists guard_team_membership_trg on public.team_members;
create trigger guard_team_membership_trg
  before insert or update on public.team_members
  for each row execute function public.guard_team_membership();

-- An owner may remove members, but not strand the team with no owner.
create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role <> 'owner' then return old; end if;

  if (select count(*) from public.team_members
      where team_id = old.team_id and role = 'owner') <= 1 then
    raise exception 'cannot remove the last owner of a team';
  end if;

  return old;
end $$;

drop trigger if exists guard_last_owner_trg on public.team_members;
create trigger guard_last_owner_trg
  before delete on public.team_members
  for each row execute function public.guard_last_owner();

-- ===========================================================================
-- 3. ENABLE RLS EVERYWHERE
-- A table with RLS enabled and no matching policy denies by default. That is the
-- intended state for every "service role only" write path below.
-- ===========================================================================

alter table public.profiles            enable row level security;
alter table public.teams               enable row level security;
alter table public.team_members        enable row level security;
alter table public.tracks              enable row level security;
alter table public.learning_modules    enable row level security;
alter table public.quizzes             enable row level security;
alter table public.quiz_attempts       enable row level security;
alter table public.reference_papers    enable row level security;
alter table public.rubrics             enable row level security;
alter table public.guidebooks          enable row level security;
alter table public.proposals           enable row level security;
alter table public.proposal_versions   enable row level security;
alter table public.evaluations         enable row level security;
alter table public.competition_results enable row level security;
alter table public.events              enable row level security;

-- ===========================================================================
-- 4. POLICIES
-- ===========================================================================

-- ------------------------------------------------------------------ profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_team_with(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and is_admin = false);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));   -- is_admin held immutable by trigger

-- --------------------------------------------------------------------- teams
-- INSERT has no policy: teams are created by the createTeam server action, which
-- must also write the owner membership row. Both happen under the service role
-- so a team can never exist without an owner.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
  using (public.is_team_member(id));

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated
  using (public.is_team_owner(id))
  with check (public.is_team_owner(id));

drop policy if exists teams_delete on public.teams;
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_team_owner(id));

-- -------------------------------------------------------------- team_members
-- SELECT and DELETE only. No INSERT/UPDATE policy, by design (see header).
drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists team_members_delete on public.team_members;
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.is_team_owner(team_id));

-- ------------------------------------------------------------ global content
-- Read-only to every signed-in user; no write policy means service role only.
drop policy if exists tracks_select on public.tracks;
create policy tracks_select on public.tracks for select to authenticated using (true);

drop policy if exists learning_modules_select on public.learning_modules;
create policy learning_modules_select on public.learning_modules for select to authenticated using (true);

drop policy if exists reference_papers_select on public.reference_papers;
create policy reference_papers_select on public.reference_papers for select to authenticated using (true);

-- quizzes: row-readable, but answer_key_json is revoked at column level below.
drop policy if exists quizzes_select on public.quizzes;
create policy quizzes_select on public.quizzes for select to authenticated using (true);

-- --------------------------------------------------------------- quiz_attempts
-- Read your own; writes are service-role only so that scores are trustworthy in
-- the admin dashboard. A client-writable score column is a fabricated metric.
drop policy if exists quiz_attempts_select on public.quiz_attempts;
create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()));

-- ------------------------------------------------------------------- rubrics
-- team_id null = built-in default, visible to everyone.
drop policy if exists rubrics_select on public.rubrics;
create policy rubrics_select on public.rubrics for select to authenticated
  using (team_id is null or public.is_team_member(team_id));

drop policy if exists rubrics_insert on public.rubrics;
create policy rubrics_insert on public.rubrics for insert to authenticated
  with check (
    team_id is not null
    and public.is_team_member(team_id)
    and source = 'compiled_from_guidebook'   -- clients cannot mint 'default' rubrics
  );

-- Editable only until it has scored something (see rubric_is_unused).
drop policy if exists rubrics_update on public.rubrics;
create policy rubrics_update on public.rubrics for update to authenticated
  using (team_id is not null and public.is_team_member(team_id) and public.rubric_is_unused(id))
  with check (team_id is not null and public.is_team_member(team_id));

drop policy if exists rubrics_delete on public.rubrics;
create policy rubrics_delete on public.rubrics for delete to authenticated
  using (team_id is not null and public.is_team_owner(team_id) and public.rubric_is_unused(id));

-- ---------------------------------------------------------------- guidebooks
-- UPDATE has no policy: status and rubric_id are written by the compiler.
drop policy if exists guidebooks_select on public.guidebooks;
create policy guidebooks_select on public.guidebooks for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists guidebooks_insert on public.guidebooks;
create policy guidebooks_insert on public.guidebooks for insert to authenticated
  with check (public.is_team_member(team_id) and status = 'uploaded');

drop policy if exists guidebooks_delete on public.guidebooks;
create policy guidebooks_delete on public.guidebooks for delete to authenticated
  using (public.is_team_member(team_id));

-- ----------------------------------------------------------------- proposals
drop policy if exists proposals_select on public.proposals;
create policy proposals_select on public.proposals for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated
  with check (public.is_team_member(team_id));

drop policy if exists proposals_update on public.proposals;
create policy proposals_update on public.proposals for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

drop policy if exists proposals_delete on public.proposals;
create policy proposals_delete on public.proposals for delete to authenticated
  using (public.is_team_owner(team_id));

-- --------------------------------------------------------- proposal_versions
-- No UPDATE policy: a version is an immutable snapshot. extracted_text is filled
-- in by the pipeline under the service role.
-- The WITH CHECK below is belt-and-braces: the inherit trigger overwrites team_id
-- with the parent's value before this is evaluated, so a forged team_id fails here.
drop policy if exists proposal_versions_select on public.proposal_versions;
create policy proposal_versions_select on public.proposal_versions for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists proposal_versions_insert on public.proposal_versions;
create policy proposal_versions_insert on public.proposal_versions for insert to authenticated
  with check (
    public.is_team_member(team_id)
    and exists (select 1 from public.proposals p
                where p.id = proposal_id and public.is_team_member(p.team_id))
  );

drop policy if exists proposal_versions_delete on public.proposal_versions;
create policy proposal_versions_delete on public.proposal_versions for delete to authenticated
  using (public.is_team_owner(team_id));

-- --------------------------------------------------------------- evaluations
-- Client-read, server-write. status / result_json / cost_usd / tokens are written
-- only by the pipeline, and the 3-per-24h rate limit is enforceable precisely
-- because there is exactly one code path that can insert here.
-- Realtime honours this SELECT policy, so subscribing to pipeline state is safe.
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations for select to authenticated
  using (public.is_team_member(team_id));

-- -------------------------------------------------------- competition_results
-- Self-reported outcomes; team members write their own.
drop policy if exists competition_results_select on public.competition_results;
create policy competition_results_select on public.competition_results for select to authenticated
  using (public.is_team_member(team_id));

drop policy if exists competition_results_insert on public.competition_results;
create policy competition_results_insert on public.competition_results for insert to authenticated
  with check (public.is_team_member(team_id));

drop policy if exists competition_results_delete on public.competition_results;
create policy competition_results_delete on public.competition_results for delete to authenticated
  using (public.is_team_member(team_id));

-- -------------------------------------------------------------------- events
-- No INSERT policy: telemetry is written by logEvent() under the service role, so
-- user_id, team_id and event_name cannot be forged. Admins read it.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (public.is_admin());

-- ===========================================================================
-- 5. COLUMN PRIVILEGES — the quiz answer key
--
-- RLS is row-level and cannot hide a column, so questions and the answer key are
-- separate columns and the key is protected with a column privilege instead.
--
-- The order below matters, and it is the whole trick. A column-level
--     revoke select (answer_key_json) on quizzes from authenticated;
-- is a NO-OP whenever a table-level SELECT grant exists — and Supabase grants
-- exactly that to anon/authenticated by default. Table-level SELECT implies every
-- column, and Postgres will not carve one back out. So we drop the table-level
-- grant first, then re-grant SELECT on the safe columns only.
--
-- Consequence worth knowing: `select *` on quizzes now ERRORS for a user-scoped
-- client rather than silently omitting the column. That is the desired failure
-- mode — client code must name its columns. Scoring runs server-side under the
-- service role, which bypasses all of this.
--
-- Caveat: re-running Supabase's blanket `grant all on all tables in schema public
-- to authenticated` would undo this. Re-run this migration if that ever happens;
-- scripts/rls-test.ts asserts the column is unreadable and will catch it.
-- ===========================================================================

revoke select on public.quizzes from anon, authenticated;

grant select (id, module_id, questions_json, pass_threshold, created_at)
  on public.quizzes to authenticated;
