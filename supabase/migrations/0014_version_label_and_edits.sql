-- Champio — migration 0014: name a version, and let a competition be renamed
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Three edits the product was missing: rename a competition, name a version, and
-- delete a version. Two of them already had policies (proposals UPDATE is
-- is_team_member, proposal_versions DELETE is is_team_owner); this migration is
-- about the third, which is the one with a real design problem.
--
-- A version had nothing to rename. It is identified by version_number alone, and
-- the file name captured at upload was thrown away. So this adds a label, and
-- backfills nothing — an unlabelled version keeps showing as "v3", which is a
-- perfectly good name.
--
-- The hard part is that proposal_versions deliberately has NO update policy: a
-- version is an immutable snapshot, and the whole v1-vs-v2 delta depends on that.
-- Supabase issues a blanket `grant all on all tables in schema public to
-- authenticated`, so simply adding an UPDATE policy would hand clients write
-- access to *every* column — extracted_text, file_path, version_number included.
-- Rewriting extracted_text would silently change what a score was based on.
--
-- So the policy scopes which ROWS may be touched, and a trigger scopes which
-- COLUMNS — the same split already used for profiles.is_admin in 0002, because
-- RLS WITH CHECK cannot compare NEW against OLD per column.

alter table public.proposal_versions
  add column if not exists label text
    check (label is null or length(btrim(label)) between 1 and 120);

comment on column public.proposal_versions.label is
  'Optional human name for this version, defaulted to the uploaded file name. '
  'Null renders as "v{version_number}". The only column a client may update.';

-- ---------------------------------------------------------------------------
-- Row scope: your own team's versions.
-- ---------------------------------------------------------------------------
drop policy if exists proposal_versions_update on public.proposal_versions;
create policy proposal_versions_update on public.proposal_versions for update to authenticated
  using (public.is_team_member(team_id))
  with check (public.is_team_member(team_id));

-- ---------------------------------------------------------------------------
-- Column scope: label only.
--
-- Under the service role auth.uid() is null — that is the pipeline writing
-- extracted_text, extracted_meta and content_hash, which must keep working.
-- ---------------------------------------------------------------------------
create or replace function public.guard_version_immutable()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;

  if new.id             is distinct from old.id
  or new.proposal_id    is distinct from old.proposal_id
  or new.team_id        is distinct from old.team_id
  or new.version_number is distinct from old.version_number
  or new.file_path      is distinct from old.file_path
  or new.file_type      is distinct from old.file_type
  or new.extracted_text is distinct from old.extracted_text
  or new.extracted_meta is distinct from old.extracted_meta
  or new.content_hash   is distinct from old.content_hash
  or new.created_by     is distinct from old.created_by
  or new.created_at     is distinct from old.created_at
  then
    raise exception 'a version is immutable except for its label';
  end if;

  return new;
end $$;

drop trigger if exists guard_version_immutable_trg on public.proposal_versions;
create trigger guard_version_immutable_trg
  before update on public.proposal_versions
  for each row execute function public.guard_version_immutable();

-- ---------------------------------------------------------------------------
-- Backfill: name existing versions after the file they came from where we can.
-- We never stored the file name, so there is nothing to recover — this is left
-- deliberately empty, and those versions keep rendering as "v{n}" until renamed.
-- ---------------------------------------------------------------------------
