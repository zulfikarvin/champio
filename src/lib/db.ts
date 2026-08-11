import type { Database, Json } from "@/lib/database.types";

/**
 * The import surface for database types.
 *
 * Application code imports from here, never from `database.types.ts` directly,
 * because that file is overwritten wholesale by `npm run db:types`. Everything
 * below is *derived* from the generated `Database` type, so a regeneration
 * cannot break these names — and if a column or enum member disappears from the
 * schema, the failure shows up here as a type error rather than at a call site.
 */

export type { Database, Json };

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

export type TeamRole = Enums<"team_role">;
export type RubricSource = Enums<"rubric_source">;
export type GuidebookStatus = Enums<"guidebook_status">;
export type EvaluationStatus = Enums<"evaluation_status">;
export type SubmissionFileType = Enums<"submission_file_type">;

/**
 * Narrows a value to the `Json` column type.
 *
 * Everything passed through here has already been validated by Zod, so it is
 * plain data — objects, arrays, and primitives — and therefore genuinely
 * JSON-serialisable. TypeScript cannot infer that from a Zod output type, so this
 * is the one documented place the assertion is made rather than scattering
 * `as unknown as Json` across the pipeline.
 *
 * Do not use it on class instances, Dates, Maps, or anything with methods.
 */
export function toJson(value: unknown): Json {
  return value as Json;
}

/** Pipeline states that are not terminal — what the sweeper re-drives. */
export const PENDING_EVALUATION_STATUSES = [
  "queued",
  "extracting",
  "evaluating",
] as const satisfies readonly EvaluationStatus[];
