-- Champio — migration 0009: a guidebook belongs to a proposal
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Model change. A proposal now represents a *competition entry*:
--
--   proposal (a competition)
--     ├── one guidebook        → compiles into this competition's rubric
--     └── many versions        → v1, v2, v3 scored against that rubric
--
-- Previously guidebooks were team-scoped and lived in their own section, which
-- meant a team with three competitions had three guidebooks in a flat list with
-- nothing tying each to the entry it governed. The rubric a version is judged
-- against comes from a specific competition's guidebook, so that is where the
-- guidebook belongs.
--
-- `team_id` stays. It is what every RLS policy on this table keys off, and it is
-- kept in step with the parent proposal by trigger rather than trusted from the
-- client — the same arrangement proposal_versions and evaluations already use.

alter table public.guidebooks
  add column if not exists proposal_id uuid references public.proposals(id) on delete cascade;

comment on column public.guidebooks.proposal_id is
  'The competition entry this guidebook governs. Null only for guidebooks '
  'uploaded before migration 0009, which had no proposal to belong to.';

-- One guidebook per proposal. A competition has one set of judging criteria; two
-- guidebooks on one entry would leave it ambiguous which rubric applies.
create unique index if not exists guidebooks_one_per_proposal
  on public.guidebooks(proposal_id)
  where proposal_id is not null;

create index if not exists guidebooks_proposal_idx
  on public.guidebooks(proposal_id);

-- team_id is derived from the parent proposal, never accepted from the client —
-- matching inherit_team_id_from_proposal on proposal_versions. Only applied when
-- a proposal is named, so the pre-0009 rows keep the team they were uploaded to.
create or replace function public.inherit_team_id_from_proposal_optional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.proposal_id is null then
    return new;
  end if;

  select p.team_id into new.team_id
    from public.proposals p where p.id = new.proposal_id;

  if new.team_id is null then
    raise exception 'parent proposal % not found', new.proposal_id;
  end if;

  return new;
end $$;

drop trigger if exists guidebooks_inherit_team on public.guidebooks;
create trigger guidebooks_inherit_team
  before insert or update of proposal_id on public.guidebooks
  for each row execute function public.inherit_team_id_from_proposal_optional();
