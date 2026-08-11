import "server-only";

import { generateJson, LlmError } from "@/lib/ai/gemini";
import { EVALUATION_MODEL } from "@/lib/ai/pricing";
import {
  buildCompilePrompt,
  COMPILE_PROMPT_VERSION,
  COMPILE_SYSTEM_INSTRUCTION,
} from "@/lib/ai/prompts/compile-rubric";
import { toJson } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { extractPdf, ExtractionError } from "@/lib/extraction/pdf";
import {
  compiledRubricDraftSchema,
  finaliseDraft,
} from "@/lib/schemas/rubric";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Compiles a competition guidebook into a rubric draft.
 *
 * Deliberately the same shape as runEvaluation: state advances in the database at
 * each step, the function never throws, and a failure is a `failed` row with the
 * reason stored. It is invoked from `after()`, where nothing is listening for an
 * exception.
 *
 * The result lands in `guidebooks.compiled_json`, NOT in `rubrics`. A rubrics row
 * is immediately selectable when creating a proposal, so an unreviewed rubric
 * would be usable before anyone had checked what the model read out of the PDF.
 * The user reviews and saves; only then does a rubric exist.
 *
 * Uses the evaluation-grade model rather than the fast one. This runs once per
 * competition and produces the yardstick every later score depends on — the wrong
 * place to economise.
 */

const EXTRACTED_TEXT_LIMIT = 400_000;

export async function runCompilation(guidebookId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: guidebook, error: loadError } = await admin
    .from("guidebooks")
    .select("id, team_id, file_path, status, rubric_id")
    .eq("id", guidebookId)
    .single();

  if (loadError || !guidebook) {
    console.error(`[compiler] guidebook ${guidebookId} not found`);
    return;
  }

  if (guidebook.status === "complete" || guidebook.rubric_id) return; // already done

  const fail = async (message: string) => {
    console.error(`[compiler] ${guidebookId} failed: ${message}`);
    await admin
      .from("guidebooks")
      .update({ status: "failed", error: message.slice(0, 2000) })
      .eq("id", guidebookId);
  };

  try {
    await admin
      .from("guidebooks")
      .update({ status: "compiling", error: null })
      .eq("id", guidebookId);

    // The track is only a hint for the model about which section to read; the
    // guidebook itself is the source of truth.
    const { data: proposalTrack } = await admin
      .from("tracks")
      .select("name")
      .eq("slug", "business_plan")
      .maybeSingle();

    const { data: file, error: downloadError } = await admin.storage
      .from("guidebooks")
      .download(guidebook.file_path);

    if (downloadError || !file) {
      await fail(`The uploaded guidebook could not be read: ${downloadError?.message}`);
      return;
    }

    let documentText: string;
    let meta;
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

    let draft;
    try {
      const generated = await generateJson({
        model: EVALUATION_MODEL,
        systemInstruction: COMPILE_SYSTEM_INSTRUCTION,
        prompt: buildCompilePrompt({
          documentText,
          meta,
          trackName: proposalTrack?.name ?? "business plan",
        }),
        // The loose draft schema: weights come back as the guidebook writes them
        // (often percentages) and are rescaled afterwards.
        schema: compiledRubricDraftSchema,
      });
      draft = generated.data;
    } catch (cause) {
      await fail(cause instanceof LlmError ? cause.message : String(cause));
      return;
    }

    // Rescale to a distribution and validate against the real contract. If this
    // throws, the draft has a problem rescaling cannot fix — duplicate keys, say.
    let rubric;
    try {
      rubric = finaliseDraft(draft);
    } catch (cause) {
      await fail(
        `The compiled rubric was not valid: ${
          cause instanceof Error ? cause.message.split("\n")[0] : String(cause)
        }`,
      );
      return;
    }

    await admin
      .from("guidebooks")
      .update({
        status: "complete",
        compiled_json: toJson(rubric),
        error: null,
      })
      .eq("id", guidebookId);

    await logEvent({
      name: "guidebook_compiled",
      teamId: guidebook.team_id,
      properties: {
        guidebook_id: guidebookId,
        criteria_count: rubric.criteria.length,
        prompt_version: COMPILE_PROMPT_VERSION,
        model: EVALUATION_MODEL,
      },
    });
  } catch (cause) {
    await fail(
      `Unexpected compiler error: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}
