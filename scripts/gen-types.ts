/**
 * Regenerates src/lib/database.types.ts from the hosted Supabase project.
 *
 *   npm run db:types
 *
 * Wrapped in a script rather than an inline npm script because `$VAR` expansion
 * does not work in npm scripts on Windows (they run through cmd.exe), and this
 * project is developed there.
 *
 * Requires SUPABASE_PROJECT_REF in .env.local and a logged-in CLI
 * (`npx supabase login`).
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) {
  console.error("SUPABASE_PROJECT_REF is not set in .env.local");
  process.exit(1);
}

const OUT = "src/lib/database.types.ts";

console.log(`Generating types from project ${ref}…`);

try {
  const output = execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "gen", "types", "typescript", "--project-id", ref],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );

  if (!output.includes("export type Database")) {
    console.error("Unexpected CLI output — refusing to overwrite:\n", output.slice(0, 500));
    process.exit(1);
  }

  const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Regenerate with \`npm run db:types\` after changing a migration.
 */
`;

  writeFileSync(OUT, banner + output, "utf8");
  console.log(`Wrote ${OUT}`);
} catch (error) {
  console.error("Type generation failed. Is the CLI logged in (`npx supabase login`)?");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
