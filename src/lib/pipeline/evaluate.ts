import "server-only";

import { generateJson, LlmError, type Usage } from "@/lib/ai/gemini";
import { EVALUATION_MODEL } from "@/lib/ai/pricing";
import {
  buildEvaluationPrompt,
  EVALUATE_PROMPT_VERSION,
  EVALUATE_SYSTEM_INSTRUCTION,
} from "@/lib/ai/prompts/evaluate";
import { extractPdf, ExtractionError, type ExtractedMeta } from "@/lib/extraction/pdf";
import { logEvent } from "@/lib/events";
import {
  checkCountableRules,
  fuzzyRulesFor,
  mergeFormatCompliance,
} from "@/lib/pipeline/format-rules";
import {
  computeOverallScore,
  evaluationResultSchemaFor,
  type EvaluationResult,
} from "@/lib/schemas/evaluation";
import { parseRubric } from "@/lib/schemas/rubric";
import { toJson } from "@/lib/db";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The evaluation pipeline: queued → extracting → evaluating → complete | failed.
 *
 * Runs under the service role because `evaluations` has no client write policy —
 * status, scores and cost are server-owned. State is advanced in the database at
 * each step rather than held in memory, which is what lets the sweeper pick up a
 * job whose function instance died mid-flight, and what lets the client follow
 * along over Realtime.
 *
 * This function never throws. A failure is a `failed` row with the reason stored,
 * because it is invoked from `after()` where nothing is listening for an
 * exception — an unhandled throw there is a job that hangs in `evaluating`
 * forever with no explanation.
 */

const EXTRACTED_TEXT_LIMIT = 600_000; // ~150k tokens, well inside the context window

export async function runEvaluation(evaluationId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: evaluation, error: loadError } = await admin
    .from("evaluations")
    .select("id, proposal_version_id, rubric_id, team_id, status, attempt_count")
    .eq("id", evaluationId)
    .single();

  if (loadError || !evaluation) {
    console.error(`[pipeline] evaluation ${evaluationId} not found`);
    return;
  }

  if (evaluation.status === "complete" || evaluation.status === "failed") {
    return; // already terminal; the sweeper raced a live run
  }

  const fail = async (message: string, usage?: Usage) => {
    console.error(`[pipeline] ${evaluationId} failed: ${message}`);
    await admin
      .from("evaluations")
      .update({
        status: "failed",
        error: message.slice(0, 2000),
        completed_at: new Date().toISOString(),
        ...(usage
          ? {
              token_input: usage.inputTokens,
              token_output: usage.outputTokens,
              cost_usd: usage.costUsd,
            }
          : {}),
      })
      .eq("id", evaluationId);
  };

  try {
    await admin
      .from("evaluations")
      .update({
        status: "extracting",
        started_at: new Date().toISOString(),
        attempt_count: evaluation.attempt_count + 1,
        error: null,
      })
      .eq("id", evaluationId);

    // ---------------------------------------------------------------- inputs
    const { data: version, error: versionError } = await admin
      .from("proposal_versions")
      .select("id, proposal_id, file_path, file_type, extracted_text, extracted_meta")
      .eq("id", evaluation.proposal_version_id)
      .single();

    if (versionError || !version) {
      await fail("The uploaded version could not be found.");
      return;
    }

    const { data: rubricRow, error: rubricError } = await admin
      .from("rubrics")
      .select("schema_json")
      .eq("id", evaluation.rubric_id)
      .single();

    if (rubricError || !rubricRow) {
      await fail("The rubric for this evaluation could not be found.");
      return;
    }

    let rubric;
    try {
      rubric = parseRubric(rubricRow.schema_json);
    } catch (cause) {
      await fail(
        `The rubric is not valid: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
      return;
    }

    // ------------------------------------------------------------ extraction
    // Re-used when present: a retry after an LLM failure should not re-download
    // and re-parse a document we have already read correctly.
    let documentText = version.extracted_text ?? "";
    let meta = version.extracted_meta as unknown as ExtractedMeta | null;

    if (!documentText || !meta?.page_count) {
      if (version.file_type !== "pdf") {
        await fail("Only PDF uploads are supported in this phase.");
        return;
      }

      const { data: file, error: downloadError } = await admin.storage
        .from("proposals")
        .download(version.file_path);

      if (downloadError || !file) {
        await fail(`The uploaded file could not be read: ${downloadError?.message}`);
        return;
      }

      try {
        const extracted = await extractPdf(await file.arrayBuffer());
        documentText = extracted.text.slice(0, EXTRACTED_TEXT_LIMIT);
        meta = extracted.meta;
      } catch (cause) {
        await fail(
          cause instanceof ExtractionError
            ? cause.message
            : `Extraction failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
        return;
      }

      await admin
        .from("proposal_versions")
        .update({
          extracted_text: documentText,
          extracted_meta: toJson(meta),
        })
        .eq("id", version.id);
    }

    // ------------------------------------------------------------ evaluation
    await admin
      .from("evaluations")
      .update({ status: "evaluating" })
      .eq("id", evaluationId);

    const fuzzyRules = fuzzyRulesFor(rubric.format_rules);
    const deterministic = checkCountableRules(rubric.format_rules, meta);

    let result: EvaluationResult;
    let usage: Usage;
    let attempts: number;
    let model: string;

    try {
      const generated = await generateJson({
        model: EVALUATION_MODEL,
        systemInstruction: EVALUATE_SYSTEM_INSTRUCTION,
        prompt: buildEvaluationPrompt({ rubric, documentText, meta, fuzzyRules }),
        schema: evaluationResultSchemaFor(rubric),
      });
      result = generated.data;
      usage = generated.usage;
      attempts = generated.attempts;
      model = generated.model;
    } catch (cause) {
      await fail(
        cause instanceof LlmError ? cause.message : String(cause),
        cause instanceof LlmError ? cause.usage : undefined,
      );
      return;
    }

    // The model's own overall_score is discarded in favour of the weighted mean
    // of its per-criterion scores — see the note in schemas/evaluation.ts.
    const overallScore = computeOverallScore(rubric, result.criteria_results);

    const finalResult: EvaluationResult = {
      ...result,
      overall_score: overallScore,
      format_compliance: mergeFormatCompliance(
        deterministic,
        result.format_compliance,
        fuzzyRules,
      ),
    };

    await admin
      .from("evaluations")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        overall_score: overallScore,
        result_json: toJson(finalResult),
        token_input: usage.inputTokens,
        token_output: usage.outputTokens,
        cost_usd: usage.costUsd,
        prompt_version: EVALUATE_PROMPT_VERSION,
        model,
        error: null,
      })
      .eq("id", evaluationId);

    await logEvent({
      name: "evaluation_completed",
      teamId: evaluation.team_id,
      properties: {
        evaluation_id: evaluationId,
        proposal_id: version.proposal_id,
        overall_score: overallScore,
        cost_usd: usage.costUsd,
        llm_attempts: attempts,
        prompt_version: EVALUATE_PROMPT_VERSION,
        model,
      },
    });
  } catch (cause) {
    // Last line of defence. Reaching here means a bug rather than an expected
    // failure mode, but the job must still land in a terminal state.
    await fail(
      `Unexpected pipeline error: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
