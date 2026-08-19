-- Champio — migration 0012: recognise a version whose content has not changed
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- The problem this solves, measured on real data:
--
--   v1  52678 chars  sha=dfde8d76  score 53.0   (older rubric)
--   v2  52678 chars  sha=dfde8d76  score 59.5
--   v3  52678 chars  sha=dfde8d76  score 72.5
--
-- All three are the same document, byte for byte. v2 and v3 also share a rubric,
-- a model and a prompt version — yet one criterion moved from 4 to 7 and the
-- total from 59.5 to 72.5. That is language-model sampling variance, and it makes
-- the version-to-version comparison the product is built on meaningless: a team
-- cannot tell an improvement from noise.
--
-- Temperature 0 and a fixed seed narrow the spread, but no provider guarantees
-- reproducibility, and thinking models are the least predictable. So unchanged
-- content is not re-scored at all: the previous result is reused, which makes
-- "same document, same score" a certainty rather than a probability. It also
-- saves an LLM call.
--
-- Reuse is deliberately narrow. It only applies when the extracted text AND the
-- rubric both match — a different rubric is a different question, and must be
-- asked again.

alter table public.proposal_versions
  add column if not exists content_hash text;

comment on column public.proposal_versions.content_hash is
  'SHA-256 of the extracted text, filled by the pipeline. Two versions sharing a '
  'hash are the same document, whatever their file names.';

-- Finding a reusable evaluation means looking up sibling versions by hash.
create index if not exists proposal_versions_content_hash_idx
  on public.proposal_versions(proposal_id, content_hash)
  where content_hash is not null;

alter table public.evaluations
  add column if not exists reused_from_evaluation_id uuid
    references public.evaluations(id) on delete set null;

comment on column public.evaluations.reused_from_evaluation_id is
  'Set when this score was copied from an earlier evaluation because the document '
  'and rubric were unchanged. Null means the model actually scored this version. '
  'Surfaced in the UI — a reused score should never look like a fresh judgement.';

create index if not exists evaluations_reused_from_idx
  on public.evaluations(reused_from_evaluation_id)
  where reused_from_evaluation_id is not null;

-- Backfill every version whose text we already hold, so reuse works on existing
-- competitions rather than only on uploads made from now on. Without this the ERP
-- Laboratory versions above would each keep a null hash, never match each other,
-- and the bug would persist for exactly the data that exposed it.
--
-- Postgres' sha256(bytea) and Node's createHash("sha256") agree byte for byte on
-- a UTF8 database, which is what makes a hash written here interchangeable with
-- one written by the pipeline. Verified, not assumed.
update public.proposal_versions
  set content_hash = encode(sha256(extracted_text::bytea), 'hex')
  where extracted_text is not null
    and content_hash is null;
