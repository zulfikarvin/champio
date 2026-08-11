/**
 * Pre-build environment check.
 *
 * Wired to the `prebuild` npm lifecycle hook, so it runs automatically before
 * `next build` — locally and on Vercel alike.
 *
 * It exists because of how this failure looked without it. A deploy with no
 * environment variables set spent ~50 seconds installing and compiling, then
 * failed with:
 *
 *     Error: Failed to collect configuration for /auth/callback
 *       [cause]: Error [ZodError]: [ { "expected": "string", ... } ]
 *
 * The real problem — nobody filled in the deploy settings — was three layers
 * down and named nowhere. This turns that into a one-second failure at the very
 * top of the log that says exactly which variables are missing and where to put
 * them.
 *
 * Deliberately standalone: it does not import src/lib/env.ts, because that module
 * throws on import by design and would reproduce the same buried stack trace.
 */

import { existsSync } from "node:fs";

type Requirement = {
  name: string;
  needed: string;
  /** Build fails without it; a warning otherwise. */
  required: boolean;
  validate?: (value: string) => string | null;
};

const REQUIREMENTS: Requirement[] = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    needed: "every page — inlined into the client bundle at build time",
    required: true,
    validate: (v) =>
      /^https:\/\/.+\.supabase\.(co|in)$/.test(v)
        ? null
        : "expected https://<project-ref>.supabase.co",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    needed: "every page — inlined into the client bundle at build time",
    required: true,
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    needed: "evaluation pipeline, quiz scoring, telemetry",
    required: true,
  },
  {
    name: "GEMINI_API_KEY",
    needed: "running evaluations",
    // Not build-breaking: the rest of the app is usable without it, and the
    // pipeline reports a clear error of its own when it is missing.
    required: false,
  },
  {
    name: "CRON_SECRET",
    needed: "/api/cron/sweep — the endpoint refuses every request without it",
    required: false,
  },
];

async function main() {
  // Vercel injects variables into the process directly. Locally they live in
  // .env.local, which Next loads for `next build` — but this script is a separate
  // process that runs before Next, so it has to load them itself. Awaited, or the
  // checks below would run against an unpopulated process.env.
  if (!process.env.VERCEL && existsSync(".env.local")) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local", quiet: true });
  }

  const missing: Requirement[] = [];
  const invalid: { req: Requirement; reason: string }[] = [];
  const warnings: Requirement[] = [];

  for (const req of REQUIREMENTS) {
    const value = process.env[req.name];

    if (!value || value.startsWith("PASTE_")) {
      if (req.required) missing.push(req);
      else warnings.push(req);
      continue;
    }

    const reason = req.validate?.(value) ?? null;
    if (reason) invalid.push({ req, reason });
  }

  for (const req of warnings) {
    console.warn(`  ! ${req.name} is not set — ${req.needed}`);
  }

  if (missing.length === 0 && invalid.length === 0) {
    console.log("  ✓ environment looks good");
    return;
  }

  const where = process.env.VERCEL
    ? "Vercel → Project Settings → Environment Variables\n" +
      "     Add for Production, Preview AND Development, then redeploy."
    : "your .env.local (copy .env.example and fill it in)";

  console.error("\n──────────────────────────────────────────────────────────");
  console.error(" Build stopped: environment is not configured");
  console.error("──────────────────────────────────────────────────────────\n");

  for (const req of missing) {
    console.error(`  MISSING  ${req.name}`);
    console.error(`           needed for ${req.needed}\n`);
  }
  for (const { req, reason } of invalid) {
    console.error(`  INVALID  ${req.name}`);
    console.error(`           ${reason}\n`);
  }

  console.error(`  Set these in ${where}\n`);
  console.error(
    "  Note: NEXT_PUBLIC_* values are inlined into the client bundle at\n" +
      "  build time. Adding one after a failed deploy has no effect until\n" +
      "  you trigger a new build.\n",
  );
  console.error("──────────────────────────────────────────────────────────\n");

  process.exit(1);
}

main().catch((error: unknown) => {
  console.error("env check crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
