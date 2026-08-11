/**
 * Verifies the seeded quizzes are internally consistent.
 *
 *   npm run verify:quizzes
 *
 * Reads the migration SQL directly, so it needs no database and can run in CI.
 *
 * It exists because quiz correctness is invisible at every other layer. Questions
 * and answers live in two separate columns — deliberately, since `answer_key_json`
 * is privilege-revoked so students cannot read it — which means nothing in the
 * app ever compares the two. A `correct_index` of 3 against a three-option
 * question would render fine, grade every student wrong, and never raise an error.
 *
 * Checks per quiz:
 *   - both blocks parse against the Zod schemas
 *   - question ids and answer ids match exactly, one to one
 *   - every correct_index is a valid index into that question's options
 *   - every answer carries an explanation
 *   - the answer distribution is not degenerate (e.g. every answer is option A)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  quizAnswerKeySchema,
  quizQuestionsSchema,
  type QuizAnswer,
  type QuizQuestion,
} from "../src/lib/schemas/quiz";

const MIGRATIONS_DIR = "supabase/migrations";

/** Pulls `$json$ … $json$` dollar-quoted blocks out of a migration. */
function extractJsonBlocks(sql: string): string[] {
  const blocks: string[] = [];
  const pattern = /\$json\$([\s\S]*?)\$json\$/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sql)) !== null) blocks.push(match[1]);
  return blocks;
}

function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name));

  const failures: string[] = [];
  const warnings: string[] = [];
  let quizCount = 0;
  /** Correct-answer position counts across every quiz, for the bias check. */
  const positionCounts = new Map<number, number>();

  for (const file of files) {
    const blocks = extractJsonBlocks(readFileSync(file, "utf8"));
    if (blocks.length === 0) continue;

    if (blocks.length % 2 !== 0) {
      failures.push(`${file}: odd number of JSON blocks — questions/answers unpaired`);
      continue;
    }

    // Blocks alternate questions, answers, questions, answers …
    for (let i = 0; i < blocks.length; i += 2) {
      const label = `${file} quiz ${i / 2 + 1}`;
      quizCount += 1;

      let questions: QuizQuestion[];
      let answers: QuizAnswer[];

      try {
        questions = quizQuestionsSchema.parse(JSON.parse(blocks[i]));
        answers = quizAnswerKeySchema.parse(JSON.parse(blocks[i + 1]));
      } catch (error) {
        failures.push(
          `${label}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
        );
        continue;
      }

      const questionIds = questions.map((q) => q.id);
      const answerIds = answers.map((a) => a.id);

      const missing = questionIds.filter((id) => !answerIds.includes(id));
      const extra = answerIds.filter((id) => !questionIds.includes(id));
      if (missing.length > 0) failures.push(`${label}: no answer for ${missing.join(", ")}`);
      if (extra.length > 0) failures.push(`${label}: answer for unknown ${extra.join(", ")}`);

      // The check that motivates this whole script.
      for (const answer of answers) {
        const question = questions.find((q) => q.id === answer.id);
        if (!question) continue;
        if (answer.correct_index >= question.options.length) {
          failures.push(
            `${label} ${answer.id}: correct_index ${answer.correct_index} but only ` +
              `${question.options.length} options`,
          );
        }
      }

      // A quiz whose answers are all option A is answerable without reading.
      const distinct = new Set(answers.map((a) => a.correct_index));
      if (answers.length >= 4 && distinct.size === 1) {
        failures.push(`${label}: every correct answer is option ${[...distinct][0]}`);
      }

      for (const answer of answers) {
        positionCounts.set(
          answer.correct_index,
          (positionCounts.get(answer.correct_index) ?? 0) + 1,
        );
      }

      const positions = answers.map((a) => String.fromCharCode(65 + a.correct_index));
      console.log(
        `  ✓ ${label.padEnd(52)} ${questions.length}Q  answers ${positions.join("")}`,
      );
    }
  }

  // Position bias across the whole bank. A quiz gate that can be passed by always
  // choosing the same letter is not a gate — and against a 70% pass mark, one
  // option holding most of the answers gets a guesser uncomfortably close.
  const total = [...positionCounts.values()].reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    const spread = [0, 1, 2, 3]
      .map((i) => `${String.fromCharCode(65 + i)}=${positionCounts.get(i) ?? 0}`)
      .join("  ");
    console.log(`\nAnswer positions across ${total} questions:  ${spread}`);

    const commonest = Math.max(...positionCounts.values());
    const share = Math.round((commonest / total) * 100);
    if (share > 40) {
      warnings.push(
        `${share}% of correct answers sit in a single position — a student who ` +
          `always picks it scores ${share}% without reading the module.`,
      );
    }
  }

  console.log(`\n${quizCount - failures.length}/${quizCount} quizzes valid`);
  for (const warning of warnings) console.warn(`  \x1b[33m!\x1b[0m ${warning}`);

  if (failures.length > 0) {
    console.error("\nFailures:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
}

main();
