import { z } from "zod";

/**
 * Fail-fast environment access.
 *
 * Split into two schemas because the service-role key must never be reachable
 * from a bundle that ships to the browser. `serverEnv()` is called lazily rather
 * than at module scope so that importing this file from a client component does
 * not blow up the build — it throws only if something actually asks for a secret.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/** Safe on both server and client. */
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }
  return serverSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}

/** Config constants. Phase 2 reads the rate limit; declared here so it has one home. */
export const EVALUATIONS_PER_PROPOSAL_PER_DAY = 3;
