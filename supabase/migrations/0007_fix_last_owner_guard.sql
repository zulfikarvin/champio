-- Champio — migration 0007: scope the last-owner guard to client deletes
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Bug this fixes:
--   guard_last_owner (migration 0002) raises whenever the last owner row of a
--   team is deleted, with no exception for the service role. That is correct for
--   its intended case — an owner in the UI must not strand their own team — but
--   it also fires on CASCADE deletes, which makes three ordinary operations
--   impossible:
--
--     delete a team          → cascades to team_members → trigger raises
--     delete an auth user    → cascades to profiles → team_members → raises
--     remove a sole owner    → raises even from the server
--
--   Verified against the live project: all three returned
--   "cannot remove the last owner of a team", and the team was left behind.
--   Deleting an account was therefore impossible, which is a data-protection
--   problem as well as a housekeeping one.
--
-- Fix:
--   Gate the guard on auth.uid() being non-null, matching guard_profile_admin
--   and guard_team_membership. Under the service role auth.uid() is null, so
--   server-mediated deletion (removing a team, deleting an account) proceeds and
--   cascades work. A signed-in owner is still stopped from stranding their team,
--   which is the case the guard was written for.

create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Service role (server actions, cascade deletes from a parent row): trusted.
  -- Without this, deleting a team or an account is impossible, because both
  -- reach team_members through ON DELETE CASCADE.
  if auth.uid() is null then
    return old;
  end if;

  if old.role <> 'owner' then
    return old;
  end if;

  if (select count(*) from public.team_members
      where team_id = old.team_id and role = 'owner') <= 1 then
    raise exception 'cannot remove the last owner of a team';
  end if;

  return old;
end $$;
