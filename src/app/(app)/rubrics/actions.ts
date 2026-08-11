"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SaveRubricState, UploadState } from "@/app/(app)/rubrics/form-state";
import { toJson } from "@/lib/db";
import { runCompilation } from "@/lib/pipeline/compile-rubric";
import { rubricSchema } from "@/lib/schemas/rubric";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { getActiveTeam } from "@/lib/teams";

const recordSchema = z.object({
  guidebookId: z.string().uuid(),
  filePath: z.string().min(1),
  fileName: z.string().max(300).optional(),
});

/**
 * Records a guidebook the browser has already uploaded to Storage, then queues
 * compilation.
 *
 * Same shape as the proposal upload: the file goes browser → Storage directly,
 * the bucket policy enforces the team prefix, and this action only writes
 * metadata. Compilation runs in `after()` so the request returns immediately.
 */
export async function recordGuidebookAction(input: {
  guidebookId: string;
  filePath: string;
  fileName?: string;
}): Promise<UploadState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const team = await getActiveTeam();
  if (!team) return { status: "error", message: "Create a team first." };

  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: "Invalid upload details." };

  const supabase = await createClient();
  const { data: guidebook, error } = await supabase
    .from("guidebooks")
    .insert({
      id: parsed.data.guidebookId,
      team_id: team.teamId,
      uploaded_by: user.id,
      file_name: parsed.data.fileName ?? null,
      file_path: parsed.data.filePath,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !guidebook) {
    console.error("[rubrics] guidebook insert failed:", error?.message);
    return { status: "error", message: "Could not record the upload." };
  }

  revalidatePath("/rubrics");

  after(async () => {
    await runCompilation(guidebook.id);
  });

  return { status: "queued", guidebookId: guidebook.id };
}

/** Re-runs compilation, after a failure or a guidebook replacement. */
export async function recompileAction(guidebookId: string): Promise<UploadState> {
  const supabase = await createClient();
  const { data: guidebook } = await supabase
    .from("guidebooks")
    .select("id, rubric_id")
    .eq("id", guidebookId)
    .maybeSingle();

  if (!guidebook) return { status: "error", message: "Guidebook not found." };
  if (guidebook.rubric_id) {
    return {
      status: "error",
      message: "This guidebook already has a saved rubric. Create a new one instead.",
    };
  }

  // Reset through the service role: `guidebooks` has no client UPDATE policy,
  // because status and compiled_json are pipeline-owned.
  const admin = createAdminClient();
  await admin
    .from("guidebooks")
    .update({ status: "uploaded", error: null, compiled_json: null })
    .eq("id", guidebookId);

  revalidatePath(`/rubrics/${guidebookId}`);

  after(async () => {
    await runCompilation(guidebookId);
  });

  return { status: "queued", guidebookId };
}

/**
 * Saves a reviewed draft as a real rubric.
 *
 * The edited rubric is validated here rather than trusted: the browser can send
 * anything, and `rubricSchema` is the contract the evaluation pipeline depends on
 * — weights summing to 1.0, unique lower_snake_case keys, at least one criterion.
 * A rubric that fails it would produce scores nothing downstream could interpret.
 *
 * The rubric row is inserted through the user-scoped client so RLS confirms team
 * membership; only the guidebook back-reference needs the service role, since
 * `guidebooks` is pipeline-owned on update.
 */
export async function saveCompiledRubricAction(
  guidebookId: string,
  edited: unknown,
): Promise<SaveRubricState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "You must be signed in." };

  const parsed = rubricSchema.safeParse(edited);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      status: "error",
      message: issue
        ? `${issue.path.join(".") || "rubric"}: ${issue.message}`
        : "The rubric is not valid.",
    };
  }

  const supabase = await createClient();

  const { data: guidebook } = await supabase
    .from("guidebooks")
    .select("id, team_id, rubric_id")
    .eq("id", guidebookId)
    .maybeSingle();

  if (!guidebook) return { status: "error", message: "Guidebook not found." };
  if (guidebook.rubric_id) {
    return { status: "error", message: "This guidebook already has a saved rubric." };
  }

  // A compiled rubric needs a track. The guidebook does not carry one, so it is
  // attached to the track the user picks when creating a proposal; we store it
  // against business_plan by default and let the proposal form offer it for any
  // track the team works in.
  const { data: track } = await supabase
    .from("tracks")
    .select("id")
    .eq("slug", "business_plan")
    .single();

  const { data: rubric, error } = await supabase
    .from("rubrics")
    .insert({
      team_id: guidebook.team_id,
      track_id: track!.id,
      name: parsed.data.rubric_name,
      source: "compiled_from_guidebook",
      schema_json: toJson(parsed.data),
    })
    .select("id")
    .single();

  if (error || !rubric) {
    console.error("[rubrics] rubric insert failed:", error?.message);
    return { status: "error", message: "Could not save the rubric." };
  }

  const admin = createAdminClient();
  await admin
    .from("guidebooks")
    .update({ rubric_id: rubric.id })
    .eq("id", guidebookId);

  revalidatePath("/rubrics");
  revalidatePath("/proposals/new");

  return { status: "saved", rubricId: rubric.id };
}
