-- Champio — migration 0013: accounts that are exempt from the evaluation limit
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- The 3-per-competition-per-24h limit exists to cap Gemini spend, and it should
-- keep applying to real users. But it also blocks the demo account, which exists
-- precisely to be run over and over while testing — hitting a quota on a seeded
-- test account is friction with no upside.
--
-- So exemption is a property of the account, not a global switch: the limit stays
-- on for everyone else, and turning it off for one more account later is an UPDATE
-- rather than a deploy.
--
-- Why not reuse is_admin: the demo user is deliberately NOT an admin (the smoke
-- test asserts /admin returns 404 for it), and "may run unlimited evaluations" is
-- a different claim from "may read everyone's telemetry". Conflating the two would
-- mean granting the demo account the admin dashboard to lift a rate limit.

alter table public.profiles
  add column if not exists evaluation_limit_exempt boolean not null default false;

comment on column public.profiles.evaluation_limit_exempt is
  'When true, enqueueEvaluation skips the per-competition daily cap for this user. '
  'Server-assigned — a client that could set this could spend unlimited API credit.';

-- ---------------------------------------------------------------------------
-- Guard: this column is exactly as dangerous as is_admin, so it gets the same
-- protection. RLS WITH CHECK cannot compare NEW against OLD per column, so the
-- immutability has to be a trigger.
--
-- Replaces guard_profile_admin with a broader guard covering both server-assigned
-- columns. Under the service role auth.uid() is null — trusted, let it through.
-- ---------------------------------------------------------------------------

drop trigger if exists guard_profile_admin_trg on public.profiles;

create or replace function public.guard_profile_server_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    if new.is_admin then
      raise exception 'profiles.is_admin is server-assigned, not client-writable';
    end if;
    if new.evaluation_limit_exempt then
      raise exception 'profiles.evaluation_limit_exempt is server-assigned, not client-writable';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'profiles.is_admin is not client-writable';
    end if;
    if new.evaluation_limit_exempt is distinct from old.evaluation_limit_exempt then
      raise exception 'profiles.evaluation_limit_exempt is not client-writable';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists guard_profile_server_columns_trg on public.profiles;
create trigger guard_profile_server_columns_trg
  before insert or update on public.profiles
  for each row execute function public.guard_profile_server_columns();

drop function if exists public.guard_profile_admin();

-- Belt and braces, mirroring how is_admin is handled in 0002: the trigger is the
-- real enforcement, the policy states the intent.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (
    id = (select auth.uid())
    and is_admin = false
    and evaluation_limit_exempt = false
  );

-- ---------------------------------------------------------------------------
-- Grant it to the demo account.
--
-- Looked up by email rather than pasted as a uuid, so this migration is portable
-- to a fresh project where the seed produced a different id. Harmless no-op if the
-- demo user has not been seeded yet.
-- ---------------------------------------------------------------------------
update public.profiles p
  set evaluation_limit_exempt = true
  from auth.users u
  where u.id = p.id
    and u.email = 'demo@champio.test'
    and p.evaluation_limit_exempt = false;
