import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation / recovery landing route.
 *
 * Supabase sends one of two shapes depending on how the project is configured,
 * so both are handled here rather than guessing:
 *   - PKCE:       ?code=...
 *   - OTP link:   ?token_hash=...&type=email
 *
 * Either way the session cookie is set by the Supabase client before we redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only relative same-origin paths, so this link cannot be reused as an open redirect.
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const failed = new URL("/login", origin);
  failed.searchParams.set("error", "confirmation_failed");
  return NextResponse.redirect(failed);
}
