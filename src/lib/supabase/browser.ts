import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Client-component client. Used for auth calls and for Realtime subscriptions to
 * evaluation state — Realtime honours the SELECT policy on `evaluations`, so a
 * team only ever receives its own pipeline updates.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
