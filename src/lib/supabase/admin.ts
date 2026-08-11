import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * The `server-only` import above turns an accidental client-component import into
 * a build error rather than a leaked service key.
 *
 * Legitimate uses are narrow, and each corresponds to a table where the policies
 * in 0002 deliberately give clients no write path:
 *   - createTeam / acceptInvite  -> team_members is not client-writable
 *   - logEvent                   -> events must not be forgeable
 *   - the evaluation pipeline    -> status/result/cost are server-owned
 *   - quiz scoring               -> reads quizzes.answer_key_json, writes attempts
 *
 * Anything else should go through the user-scoped client so RLS still applies.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
