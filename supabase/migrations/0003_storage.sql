-- Champio — migration 0003: STORAGE BUCKETS + OBJECT POLICIES
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Isolation strategy: object keys are team-prefixed, and the prefix is enforced by
-- policy rather than trusted.
--     proposals/{team_id}/{proposal_id}/{version_id}.pdf
--     guidebooks/{team_id}/{guidebook_id}.pdf
--
-- All three buckets are private. Downloads go through short-lived signed URLs
-- minted server-side; nothing is ever publicly readable.

-- ---------------------------------------------------------------- buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proposals', 'proposals', false, 26214400,   -- 25 MiB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guidebooks', 'guidebooks', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reference-papers', 'reference-papers', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------- path -> team helper
-- storage.foldername(name)[1] is the first path segment. A malformed or missing
-- segment must not raise inside a policy (that would error the whole query), so
-- the cast is guarded and returns null — and is_team_member(null) is false.
create or replace function public.team_id_from_path(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return ((storage.foldername(object_name))[1])::uuid;
exception when others then
  return null;
end $$;

-- ---------------------------------------------------------------- policies
-- Note: there is deliberately no `alter table storage.objects enable row level
-- security` here. That table is owned by `supabase_storage_admin`, not by the
-- `postgres` role the SQL Editor runs as, so ALTER TABLE fails with
-- "42501: must be owner of table objects". It is also unnecessary — Supabase
-- ships storage.objects with RLS already enabled. Policy creation is granted
-- separately, which is why the statements below are fine.

-- proposals: team members read and write inside their own prefix only.
drop policy if exists proposal_files_select on storage.objects;
create policy proposal_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'proposals'
    and public.is_team_member(public.team_id_from_path(name))
  );

drop policy if exists proposal_files_insert on storage.objects;
create policy proposal_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proposals'
    and public.is_team_member(public.team_id_from_path(name))
  );

drop policy if exists proposal_files_delete on storage.objects;
create policy proposal_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'proposals'
    and public.is_team_member(public.team_id_from_path(name))
  );

-- guidebooks: same prefix rule.
drop policy if exists guidebook_files_select on storage.objects;
create policy guidebook_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'guidebooks'
    and public.is_team_member(public.team_id_from_path(name))
  );

drop policy if exists guidebook_files_insert on storage.objects;
create policy guidebook_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'guidebooks'
    and public.is_team_member(public.team_id_from_path(name))
  );

drop policy if exists guidebook_files_delete on storage.objects;
create policy guidebook_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'guidebooks'
    and public.is_team_member(public.team_id_from_path(name))
  );

-- reference-papers: global content. Readable by any signed-in user; no insert or
-- delete policy, so it is curated by the service role only.
drop policy if exists reference_paper_files_select on storage.objects;
create policy reference_paper_files_select on storage.objects for select to authenticated
  using (bucket_id = 'reference-papers');
