import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Who is exempt from the daily evaluation cap.
 *
 * The cap exists to bound Gemini spend and stays on for real users. The demo
 * account is exempt because it exists to be re-run while testing, and a quota on
 * a seeded test account is friction with no upside.
 *
 * `profiles.evaluation_limit_exempt` is server-assigned: a trigger rejects any
 * client write to it, because an account that could exempt itself could spend
 * unlimited API credit. Granting it is an UPDATE by the service role, not a
 * deploy.
 *
 * Two readers, deliberately different clients:
 *
 *   - the enforcement path runs under the service role, since it decides whether
 *     a row may be written at all
 *   - the page render reads the caller's own profile through RLS, which is all it
 *     needs to phrase a sentence, and keeps the service role out of a render
 */

/** Enforcement path. Fails closed: any error means the limit applies. */
export async function isUserExemptFromLimit(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("evaluation_limit_exempt")
    .eq("id", userId)
    .maybeSingle();

  return data?.evaluation_limit_exempt === true;
}

/** Display path — whether to tell the signed-in user about a limit they have. */
export async function isEvaluationLimitExempt(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("evaluation_limit_exempt")
    .eq("id", user.id)
    .maybeSingle();

  return data?.evaluation_limit_exempt === true;
}
