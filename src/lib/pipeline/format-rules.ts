import type { ExtractedMeta } from "@/lib/extraction/pdf";
import type { FormatCompliance } from "@/lib/schemas/evaluation";
import type { FormatRules } from "@/lib/schemas/rubric";

/**
 * Format compliance, split by what can be known for certain.
 *
 * Countable limits (slides, pages, words) are checked here in code against the
 * extraction metadata. Asking a language model to count pages is both wasteful
 * and unreliable — it is arithmetic over a document it sees as a token stream.
 *
 * The fuzzy rules (`language`, `other[]`) are the model's job, and are merged in
 * by the pipeline afterwards. Splitting them this way means a team can never be
 * told "15 of 15 slides, pass" about a 22-slide deck.
 */

type CountRule = {
  key: "max_slides" | "max_pages" | "max_words";
  limit: number | undefined;
  actual: number | null;
  noun: string;
};

export function checkCountableRules(
  rules: FormatRules,
  meta: ExtractedMeta,
): FormatCompliance[] {
  const candidates: CountRule[] = [
    { key: "max_slides", limit: rules.max_slides, actual: meta.slide_count, noun: "slide" },
    { key: "max_pages", limit: rules.max_pages, actual: meta.page_count, noun: "page" },
    { key: "max_words", limit: rules.max_words, actual: meta.word_count, noun: "word" },
  ];

  return candidates.flatMap(({ key, limit, actual, noun }) => {
    if (limit === undefined || actual === null) return [];

    const pass = actual <= limit;
    return [
      {
        rule: key,
        pass,
        note: pass
          ? `${actual} of ${limit} ${noun}s used.`
          : `${actual} ${noun}s — ${actual - limit} over the ${limit} ${noun} limit.`,
      },
    ];
  });
}

/** The rules the model must judge, phrased for the prompt. */
export function fuzzyRulesFor(rules: FormatRules): string[] {
  const fuzzy: string[] = [];

  if (rules.language) {
    fuzzy.push(
      `language: the submission must be written in ${
        rules.language === "id" ? "Bahasa Indonesia" : "English"
      }`,
    );
  }
  for (const rule of rules.other) fuzzy.push(rule);

  return fuzzy;
}

/**
 * Merges model-judged rules with the deterministic ones.
 *
 * Code wins on any rule it can compute: if the model claims `max_slides` passes
 * and our count says otherwise, the count is right. Anything the model returns
 * that we did not ask about is dropped rather than shown — an invented rule in a
 * compliance list reads as authoritative and is not.
 */
export function mergeFormatCompliance(
  deterministic: FormatCompliance[],
  fromModel: FormatCompliance[],
  fuzzyRules: string[],
): FormatCompliance[] {
  const deterministicKeys = new Set(deterministic.map((r) => r.rule));
  const allowed = new Set(fuzzyRules.map((r) => r.toLowerCase()));

  const modelRules = fromModel.filter((r) => {
    if (deterministicKeys.has(r.rule)) return false;
    const label = r.rule.toLowerCase();
    return [...allowed].some(
      (rule) => rule.includes(label) || label.includes(rule.split(":")[0].trim()),
    );
  });

  return [...deterministic, ...modelRules];
}
