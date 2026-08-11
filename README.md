# Champio

A learning-and-diagnostics platform for Indonesian university students competing
in business case, business plan and academic essay competitions.

Two modules:

1. **Track-based learning** — ordered modules per competition format, gated by
   quiz milestones, with a library of winning reference papers.
2. **AI diagnostic engine** — teams upload a draft, receive rubric-aligned scored
   feedback with evidence citations, and track score deltas across versions.

**Stack:** Next.js 16 (App Router) · TypeScript strict · Tailwind v4 · Supabase
(Auth, Postgres, Storage, RLS, Realtime) · Google Gemini · Zod · Vercel.

---

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: auth, teams, full schema + RLS, storage isolation, design system, telemetry | **Complete** |
| 2 | Diagnostic core: PDF upload, extraction, async pipeline, report screen | **Complete** |
| 3 | Delta view + PPTX support | Not started |
| 4 | Rubric Compiler (guidebook → rubric) | Not started |
| 5 | Learning tracks, skill tree, quizzes | Not started |
| 6 | Admin telemetry dashboard | Not started |

Phase 1 ships the **complete schema and RLS for every table**, not just the ones
Phase 1 uses. Rationale in ADR 2.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase keys
npm run preflight              # says exactly what is still missing
```

Apply the migrations by pasting each file into the Supabase SQL Editor, in order:

```
supabase/migrations/0001_schema.sql        tables, enums, indexes, triggers
supabase/migrations/0002_rls.sql           helpers, policies, guard triggers
supabase/migrations/0003_storage.sql       buckets + storage.objects policies
supabase/migrations/0004_seed_content.sql  3 tracks + 3 default rubrics
```

Every migration is idempotent (`create or replace`, `drop policy if exists`,
`on conflict`), so re-running one is safe.

```bash
npm run dev          # http://localhost:3000
npm run typecheck    # tsc --noEmit
npm run lint
npm run db:types     # regenerate src/lib/database.types.ts from the hosted project
npm run rls:test     # adversarial tenant-isolation suite (see ADR 3)
npm run verify:rubrics  # seeded rubrics still satisfy the Zod contract (no DB needed)
npm run seed:demo    # demo team + proposal with two evaluated versions
npm run smoke        # signed-in end-to-end render check (needs `npm run dev`)

# Phase 2 diagnostics
npm run check:extraction -- path/to.pdf   # what the model will actually be given
npm run check:pipeline   -- path/to.pdf   # full run incl. a real Gemini call
```

---

## Deploying to Vercel

The build **will fail** until these are set under Project Settings →
Environment Variables, for Production, Preview and Development:

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything |
| `SUPABASE_SERVICE_ROLE_KEY` | evaluation pipeline, quiz scoring, telemetry |
| `GEMINI_API_KEY` | evaluations |
| `CRON_SECRET` | `/api/cron/sweep` (refuses every request without it) |

Optional: `GEMINI_EVAL_MODEL`, `GEMINI_FAST_MODEL` to override the pinned models
(ADR 9). `SUPABASE_PROJECT_REF` is only used by `npm run db:types` locally and is
not needed at runtime.

`NEXT_PUBLIC_*` values are **inlined into the client bundle at build time**, so
adding one after a failed deploy does nothing until you trigger a rebuild. The
build validates them eagerly and fails with the list of what is missing rather
than shipping a bundle with `undefined` baked in.

Migrations are not run by the deploy. Apply `supabase/migrations/*.sql` to the
hosted project first, in order.

## Architecture decisions

### ADR 1 — Rubrics are data, not code

A rubric is a JSON document in the `rubrics` table, validated by a single Zod
schema in [rubric.ts](src/lib/schemas/rubric.ts). The three built-in rubrics
(seeded by migration 0004) and any rubric compiled from a competition guidebook
in Phase 4 are **the same shape in the same table**. Only the `source` column
differs — and the evaluation pipeline never reads it.

That constraint is the whole point. It means the Rubric Compiler ships without
touching the evaluation pipeline, the report screen, or the delta view: compiling
a guidebook is just another way to create a row.

Four details make this hold up in practice:

- **`criteria[].key` is a join key**, constrained to `lower_snake_case`. Results
  map onto criteria by key, and v1 results map onto v2 results by key — that is
  what makes per-criterion deltas possible for a rubric nobody anticipated.
  `evaluationResultSchemaFor(rubric)` enforces the 1:1 correspondence rather than
  assuming it.
- **Weights are a distribution**, validated to sum to 1.0 ± 0.01. A rubric whose
  weights sum to 0.8 would silently rescale every score we ever report.
  `normaliseWeights()` exists because real guidebooks say "30/30/25/10" and mean
  it proportionally.
- **`overall_score` is computed in TypeScript**, not taken from the model. We
  still ask for it, but only to compare — a large gap between the model's stated
  overall and the weighted mean of its own per-criterion scores is a useful
  signal that it misread the rubric.
- **Rubrics freeze once used.** The `UPDATE`/`DELETE` policies require
  `rubric_is_unused(id)`. A v1-vs-v2 comparison scored against two different
  rubrics is not a comparison, so editing a rubric that has evaluations must
  create a new row instead.

`format_rules` is a deliberately separate channel: `max_slides` is checked in
code against the extracted slide count, not asked of the model. Deterministic
checks stay deterministic.

### ADR 2 — RLS strategy: four access classes, no exceptions

Every table is exactly one of:

| Class | Tables | Rule |
|---|---|---|
| Global content | `tracks`, `learning_modules`, `quizzes`, `reference_papers` | authenticated read; **no write policy** ⇒ service role only |
| User-owned | `profiles`, `quiz_attempts` | `auth.uid()` match |
| Team-scoped | `teams`, `team_members`, `rubrics`, `guidebooks`, `proposals`, `proposal_versions`, `evaluations`, `competition_results` | `is_team_member(team_id)` |
| Server-only | `events` | no client write; admin read |

RLS was written in Phase 1 for all of them rather than grown table by table,
because RLS retrofitted onto live data is where tenant-isolation bugs come from.

Four decisions worth explaining:

**`team_id` is denormalised onto `proposal_versions` and `evaluations`.** The
natural schema reaches them through `proposal_id → proposals.team_id`, but a
policy that walks two joins runs per row and is easy to get subtly wrong. Every
policy here is instead one predicate. The obvious risk — a client forging
`team_id` — is closed by the `inherit_team_id_*` triggers, which overwrite it
from the parent row on every insert. So it is a *computed* column, not a second
source of truth. `scripts/rls-test.ts` asserts that a forged value is discarded.

**Membership is read through `SECURITY DEFINER` helpers.** A policy on
`team_members` that queries `team_members` recurses infinitely; a definer
function bypasses RLS on the inner read and breaks the cycle. Every such function
sets `search_path = public` — a mutable search path on a definer function is a
privilege-escalation vector. Policies use `(select auth.uid())` rather than bare
`auth.uid()` so Postgres hoists it into an InitPlan instead of re-evaluating it
per row.

**`team_members` is not client-writable at all.** No INSERT policy, no UPDATE
policy, plus a trigger that raises if `auth.uid()` is non-null. If a client can
insert into the table that anchors tenancy, it can join any team as `owner` and
every other policy in the system collapses. Team creation and invite acceptance
are therefore server actions using the service role — which also guarantees a
team can never exist without an owner. The same guard shape protects
`profiles.is_admin`.

**The quiz answer key is protected by a column privilege, not RLS.** RLS is
row-level and cannot hide a column, so `quizzes.questions_json` as originally
specified would let any student read the correct answers from DevTools. The
schema splits it: `questions_json` (client-readable) and `answer_key_json`, with
`revoke select (answer_key_json) ... from anon, authenticated`. Scoring happens
server-side. Note the consequence: `select *` on `quizzes` now *errors* for a
user-scoped client rather than silently omitting the column. That is the correct
failure mode — client code must name its columns.

Storage follows the same model. Buckets are private; object keys are
team-prefixed (`proposals/{team_id}/{proposal_id}/{version_id}.pdf`) and the
prefix is enforced by policy via `storage.foldername(name)[1]`, not merely by
convention. Downloads go through short-lived signed URLs.

### ADR 3 — Isolation is tested adversarially, not asserted

`npm run rls:test` builds two teams with two real users and then attempts, from
**user-scoped anon clients holding real JWTs**, every cross-tenant read, every
cross-tenant write, and every privilege-escalation move: joining another team,
self-promoting to owner, setting `is_admin`, forging `team_id`, writing
`evaluations` directly, forging telemetry, self-reporting a quiz score, reading
the answer key, and reaching into another team's storage prefix.

Running such a suite through the service-role key would prove nothing — that key
bypasses RLS by design, and doing so is the classic way to "verify" a policy that
is in fact wide open.

### ADR 4 — Async pipeline: the evaluations table *is* the queue

Evaluations move through `queued → extracting → evaluating → complete | failed`.
No request ever blocks on an LLM call.

The target is Vercel **Hobby**, which caps function duration at 60s and Vercel
Cron at one run per day — so a cron-driven polling worker is not viable. The
design instead:

1. `POST /api/evaluations` inserts a row with `status = 'queued'` and returns 202
   immediately.
2. Processing runs in `after()` from `next/server` — post-response work in the
   same deployment, no extra infrastructure, no second runtime.
3. The client subscribes to its own row via Supabase Realtime, which honours the
   `SELECT` policy on `evaluations`, so a team only ever receives its own updates.
4. A sweeper endpoint re-drives rows stuck in a non-terminal state (backed by a
   partial index on exactly those statuses), triggered from GitHub Actions cron
   rather than Vercel Cron.

Rejected: a Supabase Edge Function worker. It escapes Vercel's limits but splits
the codebase across two runtimes and duplicates the Zod schemas — the rubric
contract would then exist in two places, which is precisely what ADR 1 is trying
to prevent.

Because `evaluations` has no client INSERT policy, exactly one server path can
enqueue work. That is what makes the 3-evaluations-per-proposal-per-24h limit
enforceable rather than advisory.

### ADR 5 — Telemetry is first-party

`events` is written only through the service role
([events.ts](src/lib/events.ts)), never from the browser. A client-writable
events table means a forgeable `user_id`, `team_id` and `event_name` — and an
admin dashboard reporting fiction. Event names are a closed TypeScript union, so
a typo is a compile error rather than a metric that silently reads zero.

### ADR 6 — Uploads go browser → Storage, never through the server

The file never touches a Next.js function. The browser uploads straight to
Supabase Storage, and a server action afterwards records only metadata
([upload-version.tsx](src/app/\(app\)/proposals/[id]/upload-version.tsx)).

Two reasons. A Vercel function has a request body limit far below the 25MB a real
pitch deck can reach, so routing the bytes through a Server Action would cap the
product at documents smaller than its users produce. And the bucket policy —
which already enforces the team prefix — is the correct authority for whether
this team may write this object; re-implementing that check in application code
would be a second, weaker copy of a rule the database already holds.

The version id is minted client-side so the storage key and the future row agree
before either exists. If the metadata insert then fails, the client removes the
object it just wrote rather than leaving a file nothing points at.

### ADR 7 — What the model is allowed to decide

The pipeline is deliberately narrow about which judgements are the LLM's.

**Countable things are counted in code.** `max_slides`, `max_pages` and
`max_words` are checked against extraction metadata in
[format-rules.ts](src/lib/pipeline/format-rules.ts). Asking a model to count
pages is asking it to do arithmetic over a token stream. When code and model
disagree, code wins, and any rule the model invents that we did not ask about is
dropped — an invented rule in a compliance list reads as authoritative and is not.

**The overall score is arithmetic, not opinion.** The model scores each criterion
0–10; `computeOverallScore()` produces the 0–100 headline from those and the
rubric weights.

**Locations must come from the document.** Extraction emits `[page N]` markers
and the prompt requires every criterion to cite evidence carrying one. A
diagnostic that says "strengthen the analysis" is worthless; "add the sizing
assumptions behind the 5% figure on page 4" is the product.

**Calibration is explicit.** Left alone, models cluster at 7–8 for anything
competent-looking, which destroys the signal the delta view depends on: if v1
scores 7.5 and a genuinely better v2 scores 7.8, the team learns nothing. The
prompt anchors 5–6 as the honest centre and makes 7+ something to be earned. The
prompt carries a version identifier stored on every evaluation row, because a
wording change that moves scores would otherwise silently make historical
comparisons meaningless.

Output is validated against `evaluationResultSchemaFor(rubric)` — the shape *and*
the exact criterion key set. On failure the validation error is fed back for one
repair attempt, then the run fails with the reason stored. A model that cannot
produce the shape twice will not produce it on the fifth attempt, and each attempt
costs money.

### ADR 8 — The evaluations table is the queue

`queued → extracting → evaluating → complete | failed`, with state written to the
database at each transition rather than held in memory.

`POST` inserts the row and returns; `after()` from `next/server` runs the pipeline
once the response is out. No request blocks on an LLM call. The client follows its
own row over Realtime, which honours the `SELECT` policy on `evaluations`, so a
team receives only its own updates with no filtering on the client side.

The weakness of `after()` is that the work lives in the function instance that
served the request — a cold-start eviction, a deploy, or a timeout strands a row
mid-flight. That is what
[/api/cron/sweep](src/app/api/cron/sweep/route.ts) is for: it re-drives rows stuck
in a non-terminal state (backed by a partial index on exactly those statuses) and
gives up after three attempts so a poisoned job becomes a visible failure rather
than a permanent spinner. Vercel Hobby caps Cron at one run per day, so the
schedule lives in [GitHub Actions](.github/workflows/sweep.yml) instead. The
endpoint refuses every request unless `CRON_SECRET` is set and matches — an open
endpoint that triggers LLM calls is a way for a stranger to spend your money.

Because `evaluations` has no client INSERT policy, exactly one server path can
enqueue work, which is what makes the 3-per-proposal-per-24h limit a limit rather
than a suggestion. Token counts and computed USD cost are written per evaluation
at completion, using the price table in [pricing.ts](src/lib/ai/pricing.ts).

**Measured timing, and why `maxDuration` is set.** A 15-slide deck (1,455 words)
takes **~39s** end to end; a 3-page document takes ~31s. Most of that is model
thinking time, not extraction. Vercel defaults Node functions to **10s**, and
`after()` work counts against that budget — so without an explicit
`maxDuration = 60` on the proposals segment, every real evaluation would be killed
mid-flight. 60s is the Hobby ceiling, which leaves roughly 20s of headroom over a
typical deck. Denser submissions will exceed it; they are not lost, because the
row stays non-terminal and the sweeper picks it up. If that becomes common, the
levers in order are: Vercel Pro (300s), a `thinkingConfig` budget on the Gemini
call, or splitting evaluation across two calls.

### ADR 9 — Model pinning, and the 2.5 → 3.1 forced move

The spec named `gemini-2.5-pro` and `gemini-2.5-flash`. Both now return *"no
longer available to new users"* on a newly issued API key, so the pipeline targets
`gemini-3.1-pro-preview` for evaluation and `gemini-3.5-flash` for the fast tier.

Model ids are **pinned, never aliases**. `gemini-pro-latest` resolves, but it would
silently change the model underneath, and a score produced by a different model is
no more comparable to last month's than one produced by a different prompt — the
exact failure `prompt_version` exists to prevent. Both are overridable via
`GEMINI_EVAL_MODEL` / `GEMINI_FAST_MODEL` so a withdrawn preview is a config
change, not a redeploy.

This is also why [migration 0005](supabase/migrations/0005_evaluation_model.sql)
adds `evaluations.model`: prompt version alone was recording half the story.

**Cost figures are estimates until verified.** Rates for the 3.x generation are
not confirmed against Google's published pricing; entries in
[pricing.ts](src/lib/ai/pricing.ts) carry a `verified` flag and unverified ones
warn once per process rather than quietly producing authoritative-looking numbers.
Measured usage on the 15-slide deck was 3,890 in / 4,715 out ≈ **$0.05** at the
estimated rate — note output exceeds input, because thinking tokens are billed as
output and are counted here. Omitting them would under-report cost by roughly 14×.

---

## Layout

```
supabase/migrations/     idempotent SQL, applied in order via the SQL Editor
scripts/
  rls-test.ts            adversarial tenant-isolation suite (ADR 3)
  seed-demo.ts           demo team + proposal with two evaluated versions
  gen-types.ts           regenerates database.types.ts
src/
  proxy.ts               session refresh + coarse route gating (Next 16 convention)
  app/
    page.tsx             landing
    (auth)/              login, signup, server actions
    (app)/               authenticated shell: dashboard, settings, placeholders
    auth/callback/       email confirmation landing
  lib/
    db.ts                the import surface for DB types (see below)
    database.types.ts    generated / hand-mirrored; overwritten by db:types
    schemas/             rubric + evaluation Zod contracts
    supabase/            server, browser, admin, proxy clients
    events.ts            logEvent()
    teams.ts             membership reads + server-mediated team creation
    i18n.ts              t() over a flat dictionary; ready for an `id` locale
```

Application code imports database types from `@/lib/db`, never from
`database.types.ts` directly — that file is overwritten wholesale by
`npm run db:types`, and `db.ts` derives its names from the generated `Database`
type so a regeneration cannot break call sites.

UI copy goes through `t()` in [i18n.ts](src/lib/i18n.ts). English ships now;
adding Bahasa Indonesia means writing a second dictionary, not hunting literals.

## Design

Dark-on-light, built mobile-first — Indonesian students are mobile-heavy, so the
diagnostic report and learning tracks are designed at 390px and scale up. Tokens
live in [globals.css](src/app/globals.css): a deep-purple ramp
(`#10002b → #240046 → #7b2cbf → #e0aaff`), Plus Jakarta Sans, 16–24px card radii,
and shadows tinted with the brand purple rather than neutral black.
