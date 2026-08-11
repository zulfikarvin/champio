import { z } from "zod";

/**
 * Fail-fast environment access.
 *
 * Split into two schemas because the service-role key must never be reachable
 * from a bundle that ships to the browser. `serverEnv()` is called lazily rather
 * than at module scope so that importing this file from a client component does
 * not blow up the build — it throws only if something actually asks for a secret.
 *
 * The public values are validated eagerly, on purpose. `NEXT_PUBLIC_*` variables
 * are **inlined into the bundle at build time**, so a build that succeeds without
 * them produces a client bundle with `undefined` baked in — and adding the
 * variable afterwards does nothing until you rebuild. Failing the build is the
 * kinder outcome: a broken deploy that looks fine is far more expensive to
 * diagnose than one that never shipped.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

/**
 * Turns a Zod failure into something you can act on.
 *
 * The default output is a JSON dump of issue objects, which Next then reports as
 * "Failed to collect page data for /some-route" — three layers away from the
 * actual problem, which is that nobody set a variable in the deploy settings.
 */
function describeMissing(error: z.ZodError, where: string): string {
  const names = error.issues.map((issue) => issue.path.join("."));
  const detail = error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  return [
    `Missing or invalid environment variable${names.length === 1 ? "" : "s"}:`,
    detail,
    "",
    `Set ${names.length === 1 ? "it" : "them"} in ${where}.`,
    "",
    "Local:  copy .env.example to .env.local and fill in the values,",
    "        then run `npm run preflight` to check.",
    "Vercel: Project Settings → Environment Variables. Add for Production,",
    "        Preview and Development, then redeploy.",
    "",
    "NEXT_PUBLIC_* values are baked into the bundle at build time, so adding",
    "one after a deploy has no effect until you rebuild.",
  ].join("\n");
}

function readPublicEnv(): z.infer<typeof publicSchema> {
  // Referenced as literal `process.env.NEXT_PUBLIC_*` so Next's build-time
  // inlining still applies — a dynamic lookup would not be substituted.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(describeMissing(parsed.error, "your deployment environment"));
  }
  return parsed.data;
}

/** Safe on both server and client. */
export const publicEnv = readPublicEnv();

export function serverEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() was called in the browser");
  }

  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    throw new Error(describeMissing(parsed.error, "your server environment"));
  }
  return parsed.data;
}

/** Config constants. Phase 2 reads the rate limit; declared here so it has one home. */
export const EVALUATIONS_PER_PROPOSAL_PER_DAY = 3;
