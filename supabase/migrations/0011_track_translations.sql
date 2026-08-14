-- Champio — migration 0011: Indonesian names and descriptions for tracks
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- Track names and descriptions are seeded content, so the language toggle could
-- not reach them — switching to Bahasa Indonesia translated the surrounding
-- chrome and left "Academic Essay / Argument-driven academic writing…" in English
-- on every card that shows a track.
--
-- Held as columns rather than entries in the app's message dictionary. Tracks are
-- rows the founder controls; a fourth track added later should be translatable by
-- filling a field, not by shipping a code change. The dictionary stays for
-- interface strings, which is what it is good at.
--
-- Learning article titles and bodies are deliberately NOT translated here. Those
-- are long-form content — a translation is a rewrite, not a column — and the
-- articles are currently written in English by design.

alter table public.tracks
  add column if not exists name_id text,
  add column if not exists description_id text;

comment on column public.tracks.name_id is
  'Bahasa Indonesia name. Null falls back to `name`, so an untranslated track '
  'shows readable text rather than a blank label.';

update public.tracks set
  name_id = 'Esai Akademik',
  description_id = 'Penulisan akademik berbasis argumen untuk lomba esai tingkat nasional dan internasional.'
where slug = 'essay';

update public.tracks set
  name_id = 'Rencana Bisnis',
  description_id = 'Rencana usaha yang dinilai dari validasi pasar, model bisnis, dan kredibilitas keuangan.'
where slug = 'business_plan';

update public.tracks set
  name_id = 'Studi Kasus Bisnis',
  description_id = 'Pemecahan kasus dan deck rekomendasi yang dinilai dari cara berpikir terstruktur.'
where slug = 'business_case';
