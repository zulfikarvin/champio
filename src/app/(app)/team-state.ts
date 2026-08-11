/**
 * Form state for the team actions. Separate from `actions.ts` for the same
 * reason as auth-state.ts: `"use server"` modules may only export async
 * functions.
 */
export type TeamFormState = { error: string | null };

export const initialTeamFormState: TeamFormState = { error: null };
