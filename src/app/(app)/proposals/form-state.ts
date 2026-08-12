/**
 * Form state for the proposal actions. Separate from `actions.ts` because a
 * `"use server"` module may only export async functions.
 */

export type CreateProposalState = { error: string | null };
export const initialCreateProposalState: CreateProposalState = { error: null };

export type EnqueueState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "queued"; evaluationId: string };

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "queued"; guidebookId: string };

export type SaveRubricState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "saved"; rubricId: string };
