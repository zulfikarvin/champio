/**
 * Form state for the Rubric Compiler actions. Separate from `actions.ts` because
 * a `"use server"` module may only export async functions.
 */

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "queued"; guidebookId: string };

export type SaveRubricState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; rubricId: string };
