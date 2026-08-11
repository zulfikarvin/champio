import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * User-scoped client for Server Components, Server Actions and Route Handlers.
 * Every query made through this client is subject to RLS — which is the point.
 * Reach for the admin client only where a policy deliberately denies the user.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: the proxy middleware refreshes the session on
            // every request, so the token is never left stale.
          }
        },
      },
    },
  );
}

/**
 * The signed-in user, or null. Always prefer this over `getSession()` in server
 * code — getUser() revalidates the JWT against the auth server, whereas a
 * session read trusts a cookie the client could have tampered with.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
