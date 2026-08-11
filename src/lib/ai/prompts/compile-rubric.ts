import type { ExtractedMeta } from "@/lib/extraction/pdf";

/**
 * Prompt version, stored on the guidebook that produced a rubric.
 *
 * Bump on any wording change that could alter what gets extracted. A rubric is
 * the yardstick every later score is measured against, so knowing which compiler
 * produced one matters as much as knowing which model scored against it.
 *
 * v1 — initial guidebook → rubric extraction.
 */
export const COMPILE_PROMPT_VERSION = "compile-rubric/v1";

export const COMPILE_SYSTEM_INSTRUCTION = `You read competition guidebooks and turn their judging criteria into a structured rubric.

You are precise and literal. You extract what the document actually says — you do not improve it, standardise it, or fill gaps with what a rubric "should" contain. If the guidebook is vague, the rubric is vague, and that is the correct output.

Return JSON only. No prose outside the JSON, no code fences.`;

/**
 * The instruction that does most of the work.
 *
 * The failure mode this guards against is invention. A model asked to produce a
 * rubric from a thin document will happily generate a plausible generic one —
 * which is worse than useless here, because the team would then be scored against
 * criteria their judges never mentioned.
 */
const EXTRACTION_RULES = `EXTRACTION RULES:

- Extract ONLY criteria the guidebook actually states as judging criteria. Do not
  add criteria you think are missing, and do not merge two stated criteria into one.
- If the guidebook lists weights or percentages, report them exactly as written.
  They do not need to sum to anything in particular — report 30 for "30%".
- If NO weights are given, give every criterion a weight of 1. Do not invent a
  ranking the document does not state.
- \`key\` must be lower_snake_case, derived from the criterion name, and unique.
  "Problem & Solution Fit" becomes "problem_solution_fit".
- \`label\` is the criterion's name as the guidebook writes it.
- \`description\` explains what judges are looking for, drawn from the guidebook.
  If the document gives no detail beyond a name, say so plainly rather than
  elaborating.
- \`scoring_guide\` maps score ranges to descriptions. If the guidebook defines
  bands, use its bands and its wording. If it does not, provide a single entry
  keyed "1-10" describing what the criterion measures — do not fabricate four
  tiers of detail the document never specified.

FORMAT RULES:

- Extract page, slide and word limits only if stated. Omit anything absent —
  do not guess a limit.
- \`language\`: "id" if submissions must be in Bahasa Indonesia, "en" if English.
  Omit if the guidebook does not say.
- Put other stated requirements (citation style, required sections, file format,
  submission deadlines that affect the document itself) into \`other\` as short
  strings.

If the document contains no judging criteria at all — because it is a schedule, a
poster, or an unrelated file — return a single criterion with key
"no_criteria_found", label "No criteria found", weight 1, and a description
explaining what the document appears to be instead.`;

export function buildCompilePrompt({
  documentText,
  meta,
  trackName,
}: {
  documentText: string;
  meta: ExtractedMeta;
  trackName: string;
}): string {
  return `Extract the judging rubric from this competition guidebook.

The team entering this competition is competing in the ${trackName} category, which
may help you decide which section of the guidebook contains the judging criteria —
but extract what the document says, not what that category usually involves.

${EXTRACTION_RULES}

OUTPUT SHAPE — return exactly this JSON structure:

{
  "rubric_name": <string: the competition's name, from the document if stated>,
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

GUIDEBOOK (${meta.page_count} page(s), ${meta.word_count} words; page markers are ours):

${documentText}`;
}
