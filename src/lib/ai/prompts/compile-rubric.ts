import type { ExtractedMeta } from "@/lib/extraction/pdf";

/**
 * Prompt version, recorded on the guidebook that produced a rubric.
 *
 * Bump on any wording change that could alter what gets extracted. A rubric is
 * the yardstick every later score is measured against, so knowing which compiler
 * produced one matters as much as knowing which model scored against it.
 *
 * v1 — initial guidebook → rubric extraction.
 * v2 — one rubric per assessment stage. A guidebook that scores the proposal and
 *      the presentation separately was previously flattened into a single rubric,
 *      which halved every weight and applied delivery criteria to a document.
 */
export const COMPILE_PROMPT_VERSION = "compile-rubric/v2";

export const COMPILE_SYSTEM_INSTRUCTION = `You read competition guidebooks and turn their judging criteria into structured rubrics.

You are precise and literal. You extract what the document actually says — you do not improve it, standardise it, or fill gaps with what a rubric "should" contain. If the guidebook is vague, the rubric is vague, and that is the correct output.

Guidebooks are frequently in Bahasa Indonesia. Keep criterion labels in the language the document uses; write descriptions in the same language as the criteria.

Return JSON only. No prose outside the JSON, no code fences.`;

/**
 * The rule that matters most here.
 *
 * A guidebook that assesses the written proposal and the live pitch separately
 * gives two tables, each summing to 100%. Merged, they sum to 200%, normalise to
 * 100%, and a document ends up judged on "Penampilan dan Komunikasi" at half the
 * weight the guidebook assigned. Splitting them is the whole job.
 */
const STAGE_RULES = `SEPARATING ASSESSMENTS — read this first:

A guidebook usually scores more than one thing, in separate tables. For example:

    Penilaian Proposal              Penilaian Presentasi
      Kreativitas            30%      Kesesuaian dengan Proposal      30%
      Kelayakan Bisnis       30%      Kejelasan dan Struktur          25%
      Analisis Pasar         20%      Kemampuan Menjawab Pertanyaan   25%
      Analisis Keuangan      20%      Penampilan dan Komunikasi       20%

These are TWO assessments, not one list of eight criteria. Return them as two
separate sections. Never merge tables, and never carry a criterion from one
section into another.

Assign each section a \`stage\`:
  - "proposal"     — the written document, business plan, paper, or report
                     (Penilaian Proposal, Penilaian Karya Tulis, Written Submission)
  - "presentation" — the live pitch, defence, or demo day
                     (Penilaian Presentasi, Penilaian Pitching, Final Presentation)
  - "prototype"    — a product, prototype or demo assessed on its own
  - "other"        — anything that fits none of the above

If the guidebook gives only ONE table with no stage distinction, return a single
section with stage "proposal" — the written submission is what is being judged.

Weights are per section. If each table sums to 100%, report each criterion's own
percentage within its own table. Do not rescale across sections.`;

const EXTRACTION_RULES = `EXTRACTION RULES:

- Extract ONLY criteria the guidebook states as judging criteria. Do not add
  criteria you think are missing, and do not merge two stated criteria into one.
- Report weights exactly as written — 30 for "30%". They do not need to sum to
  anything in particular.
- If a section gives NO weights, give every criterion in it a weight of 1. Do not
  invent a ranking the document does not state.
- \`key\` must be lower_snake_case, derived from the criterion name, unique within
  its section. "Analisis Pasar dan Strategi Pemasaran" becomes
  "analisis_pasar_dan_strategi_pemasaran".
- \`label\` is the criterion's name as the guidebook writes it, in its language.
- \`description\` explains what judges look for, drawn from the guidebook. If the
  document gives no detail beyond a name, say so plainly rather than elaborating.
- \`scoring_guide\` maps score ranges to descriptions. Use the guidebook's own
  bands and wording where it defines them. Where it does not, provide a single
  entry keyed "1-10" describing what the criterion measures — do not fabricate
  four tiers of detail the document never specified.

FORMAT RULES — per section:

- Attach limits to the section they govern. A page limit belongs to the proposal
  section; a slide limit or time limit belongs to the presentation section.
- Extract limits only if stated. Omit anything absent — do not guess.
- \`language\`: "id" if submissions must be in Bahasa Indonesia, "en" if English.
  Omit if the guidebook does not say.
- Put other stated requirements for that section (citation style, required
  sections, file format, font and spacing) into \`other\` as short strings.

If the document contains no judging criteria at all — because it is a schedule, a
poster, or an unrelated file — return a single section with stage "other" holding
one criterion keyed "no_criteria_found", label "No criteria found", weight 1, and
a description explaining what the document appears to be instead.`;

export function buildCompilePrompt({
  documentText,
  meta,
  trackName,
}: {
  documentText: string;
  meta: ExtractedMeta;
  trackName: string;
}): string {
  return `Extract the judging rubrics from this competition guidebook.

The team is competing in the ${trackName} category, which may help you locate the
judging section — but extract what the document says, not what that category
usually involves.

${STAGE_RULES}

${EXTRACTION_RULES}

OUTPUT SHAPE — return exactly this JSON structure:

{
  "competition_name": <string: the competition's name, from the document>,
  "sections": [
    {
      "stage": <"proposal" | "presentation" | "prototype" | "other">,
      "section_name": <string: the heading as written, e.g. "Penilaian Proposal">,
      "criteria": [
        {
          "key": <lower_snake_case string>,
          "label": <string>,
          "weight": <number, as written in the guidebook; 1 if unweighted>,
          "description": <string>,
          "scoring_guide": { <range string>: <description string>, ... }
        }
      ],
      "format_rules": {
        "max_slides": <number, omit if not stated>,
        "max_pages": <number, omit if not stated>,
        "max_words": <number, omit if not stated>,
        "language": <"id" or "en", omit if not stated>,
        "other": [<string>, ...]
      }
    }
  ]
}

Return one section per assessment table in the document. Do not return two
sections with the same stage.

GUIDEBOOK (${meta.page_count} page(s), ${meta.word_count} words; page markers are ours):

${documentText}`;
}
