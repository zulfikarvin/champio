/**
 * Form state for the auth actions.
 *
 * Separate from `actions.ts` because a `"use server"` module may only export
 * async functions — exporting the initial-state object from there is a build
 * error in Next 16.
 */
export type AuthState = {
  error: string | null;
  message: string | null;
};

export const initialAuthState: AuthState = { error: null, message: null };
