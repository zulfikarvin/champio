-- Champio — migration 0004: SEED CONTENT (tracks + the three default rubrics)
-- Paste into Supabase -> SQL Editor -> Run. Idempotent; safe to re-run.
--
-- These rubrics are ordinary rows. A rubric compiled from a competition guidebook
-- in Phase 4 lands in the same table with the same shape and is consumed by the
-- same pipeline; only `source` differs, and the pipeline never reads `source`.
--
-- Every schema_json here validates against rubricSchema in
-- src/lib/schemas/rubric.ts — in particular, criteria weights sum to 1.0.

-- One default rubric per track, which also makes this migration re-runnable.
create unique index if not exists rubrics_one_default_per_track
  on public.rubrics(track_id) where source = 'default';

-- -------------------------------------------------------------------- tracks
insert into public.tracks (id, slug, name, description) values
  ('11111111-1111-4111-8111-111111111111', 'essay',
   'Academic Essay',
   'Argument-driven academic writing for national and international essay competitions.'),
  ('22222222-2222-4222-8222-222222222222', 'business_plan',
   'Business Plan',
   'Venture plans judged on market validation, business model and financial credibility.'),
  ('33333333-3333-4333-8333-333333333333', 'business_case',
   'Business Case',
   'Case cracking and recommendation decks judged on structured problem solving.')
on conflict (slug) do update
  set name = excluded.name, description = excluded.description;

-- ------------------------------------------------------- default rubrics
insert into public.rubrics (team_id, track_id, name, source, schema_json)
values (
  null,
  '33333333-3333-4333-8333-333333333333',
  'Champio Default — Business Case',
  'default',
  '{
    "rubric_name": "Champio Default — Business Case",
    "criteria": [
      {
        "key": "problem_solution_fit",
        "label": "Problem–Solution Fit",
        "weight": 0.25,
        "description": "Does the recommendation actually solve the problem stated in the case prompt, and is the link between diagnosis and solution explicit?",
        "scoring_guide": {
          "1-3": "Recommendation is generic or addresses a problem the case did not pose.",
          "4-6": "Plausible solution, but the causal link to the root problem is asserted rather than shown.",
          "7-8": "Clear diagnosis leading to a specific recommendation; the reader can follow why this solution and not another.",
          "9-10": "Root cause isolated with evidence, alternatives explicitly rejected with reasons, recommendation follows inevitably."
        }
      },
      {
        "key": "analytical_rigor",
        "label": "Analytical Rigor",
        "weight": 0.20,
        "description": "Quality of structuring (issue tree / MECE), market sizing, and use of data to support claims.",
        "scoring_guide": {
          "1-3": "Assertions without numbers; no visible structure.",
          "4-6": "Some data used, but sizing assumptions are unstated or the breakdown overlaps.",
          "7-8": "Clean MECE structure with stated assumptions and a defensible sizing approach.",
          "9-10": "Rigorous structure, sensitivity to key assumptions, and analysis that changes the answer rather than decorating it."
        }
      },
      {
        "key": "feasibility_impact",
        "label": "Feasibility & Impact",
        "weight": 0.20,
        "description": "Can the client realistically execute this, and is the quantified impact credible?",
        "scoring_guide": {
          "1-3": "Ignores client constraints; impact unquantified.",
          "4-6": "Impact estimated but implementation barriers unaddressed.",
          "7-8": "Realistic given client capability, with quantified impact and a phased plan.",
          "9-10": "Explicit risk register with mitigations, resourcing, and a timeline a client could act on Monday."
        }
      },
      {
        "key": "financial_viability",
        "label": "Financial Viability",
        "weight": 0.15,
        "description": "Cost, revenue and payback logic; internal consistency of the numbers.",
        "scoring_guide": {
          "1-3": "No financials, or figures that contradict each other.",
          "4-6": "Basic cost or revenue estimate with unstated assumptions.",
          "7-8": "Coherent P&L logic with payback or ROI and visible assumptions.",
          "9-10": "Financials tie to the operating plan, with scenario ranges and break-even clearly derived."
        }
      },
      {
        "key": "structure_clarity",
        "label": "Structure & Storyline",
        "weight": 0.10,
        "description": "Pyramid-principle storyline, action titles, and logical flow across slides.",
        "scoring_guide": {
          "1-3": "Slide titles are topic labels; no narrative thread.",
          "4-6": "Reasonable order, but the reader must assemble the argument themselves.",
          "7-8": "Action titles that read as a coherent argument top to bottom.",
          "9-10": "Reading only the titles delivers the full recommendation."
        }
      },
      {
        "key": "delivery_design",
        "label": "Visual Delivery",
        "weight": 0.10,
        "description": "Slide density, chart choice, and whether visuals carry the argument.",
        "scoring_guide": {
          "1-3": "Wall of text; charts absent or unreadable.",
          "4-6": "Clean but generic; visuals decorate rather than argue.",
          "7-8": "Purposeful charts, controlled density, consistent visual system.",
          "9-10": "Every exhibit earns its place and makes its point faster than prose could."
        }
      }
    ],
    "format_rules": {
      "max_slides": 15,
      "language": "en",
      "other": [
        "Executive summary within the first two slides",
        "Assumptions stated wherever figures are estimated"
      ]
    }
  }'::jsonb
)
on conflict (track_id) where source = 'default' do update
  set name = excluded.name, schema_json = excluded.schema_json;

insert into public.rubrics (team_id, track_id, name, source, schema_json)
values (
  null,
  '22222222-2222-4222-8222-222222222222',
  'Champio Default — Business Plan',
  'default',
  '{
    "rubric_name": "Champio Default — Business Plan",
    "criteria": [
      {
        "key": "problem_market_validation",
        "label": "Problem & Market Validation",
        "weight": 0.20,
        "description": "Evidence that the problem is real, painful, and affects a defined segment.",
        "scoring_guide": {
          "1-3": "Problem asserted from intuition; no customer evidence.",
          "4-6": "Secondary research only; segment defined loosely.",
          "7-8": "Primary evidence (interviews, surveys, pilot data) tied to a specific segment.",
          "9-10": "Quantified pain with validation data, plus evidence of willingness to pay."
        }
      },
      {
        "key": "solution_product",
        "label": "Solution & Product",
        "weight": 0.15,
        "description": "Clarity of the offering, differentiation, and stage of development.",
        "scoring_guide": {
          "1-3": "Concept only; differentiation unclear.",
          "4-6": "Described clearly but substitutes are not addressed.",
          "7-8": "Concrete product with a defensible edge over named alternatives.",
          "9-10": "Working prototype or traction, with a moat that is structural rather than aspirational."
        }
      },
      {
        "key": "business_model",
        "label": "Business Model",
        "weight": 0.20,
        "description": "How value is captured: pricing, unit economics, and cost structure.",
        "scoring_guide": {
          "1-3": "Revenue source unclear.",
          "4-6": "Pricing stated without unit economics.",
          "7-8": "Unit economics shown with CAC, LTV or margin per unit.",
          "9-10": "Unit economics validated by real data with a credible path to contribution-margin positive."
        }
      },
      {
        "key": "market_strategy",
        "label": "Go-To-Market Strategy",
        "weight": 0.15,
        "description": "Channel choice, acquisition plan, and realism of growth assumptions.",
        "scoring_guide": {
          "1-3": "Marketing described as social media with no specifics.",
          "4-6": "Channels named but no cost or conversion assumptions.",
          "7-8": "Prioritised channels with cost per acquisition and a sequenced rollout.",
          "9-10": "Channel economics evidenced by early tests, with a clear first beachhead."
        }
      },
      {
        "key": "financial_projections",
        "label": "Financial Projections",
        "weight": 0.20,
        "description": "Three-to-five year projections, assumption transparency, and funding ask.",
        "scoring_guide": {
          "1-3": "Numbers appear without derivation, or hockey-stick with no basis.",
          "4-6": "Projections present; assumptions partly stated.",
          "7-8": "Bottom-up build from stated drivers, with break-even identified.",
          "9-10": "Driver-based model with scenarios, a funding ask tied to specific milestones, and sensible use of funds."
        }
      },
      {
        "key": "team_execution",
        "label": "Team & Execution",
        "weight": 0.10,
        "description": "Founder-market fit, role coverage, and evidence of execution to date.",
        "scoring_guide": {
          "1-3": "Team listed with no relevance to the problem.",
          "4-6": "Relevant backgrounds, but gaps unacknowledged.",
          "7-8": "Clear role coverage with demonstrated progress and named gaps.",
          "9-10": "Strong founder-market fit backed by a track record of shipped milestones."
        }
      }
    ],
    "format_rules": {
      "max_slides": 20,
      "language": "en",
      "other": [
        "Financial appendix permitted beyond the slide limit",
        "Funding ask stated explicitly if raising"
      ]
    }
  }'::jsonb
)
on conflict (track_id) where source = 'default' do update
  set name = excluded.name, schema_json = excluded.schema_json;

insert into public.rubrics (team_id, track_id, name, source, schema_json)
values (
  null,
  '11111111-1111-4111-8111-111111111111',
  'Champio Default — Academic Essay',
  'default',
  '{
    "rubric_name": "Champio Default — Academic Essay",
    "criteria": [
      {
        "key": "argument_thesis",
        "label": "Thesis & Argument",
        "weight": 0.25,
        "description": "Is there a specific, arguable thesis, and does every section advance it?",
        "scoring_guide": {
          "1-3": "Descriptive summary with no arguable claim.",
          "4-6": "Thesis present but broad; some sections drift from it.",
          "7-8": "Specific, contestable thesis carried consistently through the essay.",
          "9-10": "Precise thesis that engages a genuine counterposition and defeats it."
        }
      },
      {
        "key": "evidence_research",
        "label": "Evidence & Research",
        "weight": 0.25,
        "description": "Quality, recency and integration of sources; correct citation.",
        "scoring_guide": {
          "1-3": "Few or unreliable sources; claims uncited.",
          "4-6": "Adequate sources, but quoted rather than interpreted.",
          "7-8": "Credible, current sources integrated into the argument with correct citation.",
          "9-10": "Evidence synthesised across sources, including data the writer interprets rather than reports."
        }
      },
      {
        "key": "originality_insight",
        "label": "Originality & Insight",
        "weight": 0.20,
        "description": "Does the essay contribute a perspective beyond restating the literature?",
        "scoring_guide": {
          "1-3": "Restates well-known positions.",
          "4-6": "Familiar argument with a modest local application.",
          "7-8": "Fresh angle or an original synthesis of existing work.",
          "9-10": "Genuinely novel framing that reframes how the reader sees the problem."
        }
      },
      {
        "key": "structure_coherence",
        "label": "Structure & Coherence",
        "weight": 0.15,
        "description": "Logical progression, paragraph unity, and transitions.",
        "scoring_guide": {
          "1-3": "Ideas ordered arbitrarily.",
          "4-6": "Recognisable structure with abrupt transitions.",
          "7-8": "Clear progression where each section sets up the next.",
          "9-10": "Architecture that is itself part of the argument."
        }
      },
      {
        "key": "language_mechanics",
        "label": "Language & Mechanics",
        "weight": 0.15,
        "description": "Academic register, precision, grammar, and adherence to the required format.",
        "scoring_guide": {
          "1-3": "Frequent errors that impede understanding.",
          "4-6": "Generally correct but imprecise or informal in places.",
          "7-8": "Clean academic prose with consistent formatting.",
          "9-10": "Precise, economical, and rhetorically controlled throughout."
        }
      }
    ],
    "format_rules": {
      "max_words": 3000,
      "language": "en",
      "other": [
        "APA 7th edition citation style",
        "Abstract of at most 250 words"
      ]
    }
  }'::jsonb
)
on conflict (track_id) where source = 'default' do update
  set name = excluded.name, schema_json = excluded.schema_json;
