"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthState } from "@/app/(auth)/auth-state";
import { logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
  university: z.string().trim().max(160).optional(),
});

/** Only allow same-origin relative paths, so `?next=` cannot be used as an
 *  open redirect to an attacker-controlled host. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    university: formData.get("university") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      message: null,
    };
  }

  const { email, password, fullName, university } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { error: error.message, message: null };
  if (!data.user) return { error: "Sign up failed. Try again.", message: null };

  // The profile row itself is created by the on_auth_user_created trigger.
  // University is a soft field the trigger does not carry, so it is written
  // here — via the service role, because with email confirmation enabled there
  // is no session yet and the user-scoped client could not satisfy the policy.
  if (university) {
    const admin = createAdminClient();
    await admin.from("profiles").update({ university }).eq("id", data.user.id);
  }

  await logEvent({
    name: "signup",
    userId: data.user.id,
    properties: { has_university: Boolean(university) },
  });

  // A session here means email confirmation is disabled on the project, so the
  // user is already signed in and should go straight through.
  if (data.session) redirect(safeNext(formData.get("next")));

  return {
    error: null,
    message: "Check your email to confirm your account, then sign in.",
  };
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      message: null,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  // Deliberately not distinguishing "no such user" from "wrong password":
  // that difference is a user-enumeration oracle.
  if (error) return { error: "Incorrect email or password.", message: null };

  redirect(safeNext(formData.get("next")));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
