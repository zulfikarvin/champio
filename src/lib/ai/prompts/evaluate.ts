import type { ExtractedMeta } from "@/lib/extraction/pdf";
import type { Rubric } from "@/lib/schemas/rubric";

/**
 * Prompt version identifier, stored on every evaluation row.
 *
 * Bump this whenever the wording below changes in a way that could move scores.
 * Without it, a prompt tweak silently makes every historical score
 * incomparable — and the whole product is built on comparing v1 to v2.
 *
 * v1 — initial rubric-driven evaluation prompt.
 */
export const EVALUATE_PROMPT_VERSION = "evaluate/v1";

export const EVALUATE_SYSTEM_INSTRUCTION = `You are an experienced judge for Indonesian university business competitions — business case, business plan, and academic essay categories. You have judged national and international finals and you know the difference between a submission that sounds impressive and one that would actually survive a judging panel.

You give the feedback a good coach gives: specific, located, and honest. You never soften a real problem into a vague suggestion, and you never invent a problem to seem rigorous.

Return JSON only. No prose outside the JSON, no code fences.`;

function renderCriteria(rubric: Rubric): string {
  return rubric.criteria
    .map((criterion, index) => {
      const bands = Object.entries(criterion.scoring_guide)
        .map(([range, description]) => `      ${range}: ${description}`)
        .join("\n");

      return `${index + 1}. key: "${criterion.key}"
   label: ${criterion.label}
   weight: ${(criterion.weight * 100).toFixed(0)}% of the total
   what judges look for: ${criterion.description}
   scoring bands:
${bands}`;
    })
    .join("\n\n");
}

/**
 * Calibration is the difference between a useful score and a flattering one.
 *
 * Left to themselves, models cluster around 7–8 for almost any competent-looking
 * document, which destroys the signal the delta view depends on — if v1 scores 7.5
 * and a genuinely improved v2 scores 7.8, the team learns nothing. The anchors
 * below force use of the full range and make 7+ something to be earned.
 */
const CALIBRATION = `SCORING CALIBRATION — read before scoring:

- Score each criterion 0-10 against ITS OWN scoring bands above, not against your
  general impression of the document.
- A competent, unremarkable submission scores 5-6. That is the honest centre of
  the distribution, not a punishment. Most student submissions belong here.
- 7-8 requires specific evidence in the document. 9-10 is reserved for work you
  would expect to reach a national final.
- 0-3 is correct when the criterion is essentially unaddressed. Use it.
- Do not compress toward the middle to seem fair, and do not inflate to seem
  encouraging. A team that gets 8s for a 5-level submission is being set up to
  lose a competition they thought they were ready for.
- Judge only what is present. If a section is missing, that is a low score with an
  issue naming the omission — not an assumption that it exists elsewhere.

EVIDENCE REQUIREMENTS:

- Every criterion needs at least one evidence entry: a short quote or a specific
  location from the submission, prefixed with its page marker, e.g.
  "page 4: 'we will capture 5% of the market'".
- Never fabricate a quote. If you cannot find supporting text, say so in evidence
  as "no supporting content found for this criterion" and score accordingly.
- Every issue you raise should have a corresponding fix with a concrete action and
  the location to apply it. "Improve the analysis" is not a fix. "Add the sizing
  assumptions behind the 5% figure on page 4" is.
- Order fixes by priority: 1 is the change that would raise the score most.`;

export function buildEvaluationPrompt({
  rubric,
  documentText,
  meta,
  fuzzyRules,
}: {
  rubric: Rubric;
  documentText: string;
  meta: ExtractedMeta;
  fuzzyRules: string[];
}): string {
  const criteriaKeys = rubric.criteria.map((c) => `"${c.key}"`).join(", ");

  const formatSection =
    fuzzyRules.length > 0
      ? `FORMAT RULES TO JUDGE:
${fuzzyRules.map((rule) => `- ${rule}`).join("\n")}

For each rule above, add one entry to format_compliance with "rule" set to a short
identifier for it (e.g. "language"), "pass" true or false, and a brief note.
Countable limits such as page or slide counts are checked separately — do not
report on them.`
      : `FORMAT RULES TO JUDGE: none. Return format_compliance as an empty array.`;

  return `Evaluate the submission below against the rubric "${rubric.rubric_name}".

RUBRIC CRITERIA:

${renderCriteria(rubric)}

${CALIBRATION}

${formatSection}

OUTPUT SHAPE — return exactly this JSON structure:

{
  "overall_score": <number 0-100>,
  "criteria_results": [
    {
      "key": <one of: ${criteriaKeys}>,
      "score": <number 0-10>,
      "evidence": [<string>, ...],
      "strengths": [<string>, ...],
      "issues": [<string>, ...],
      "fixes": [{ "priority": <1-5>, "action": <string>, "where": <string> }, ...]
    }
  ],
  "format_compliance": [{ "rule": <string>, "pass": <boolean>, "note": <string> }],
  "summary": <string: 2-4 sentences, the honest headline a judge would give>
}

Return exactly one entry in criteria_results for each of the ${rubric.criteria.length} criterion keys listed above — no more, no fewer, using those exact key strings.

SUBMISSION (${meta.page_count} page(s), ${meta.word_count} words; page markers are ours, not the author's):

${documentText}`;
}
