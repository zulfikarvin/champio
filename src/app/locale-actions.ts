"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/constants";
import { isLocale } from "@/lib/i18n";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Stores the chosen interface language.
 *
 * Not httpOnly: this is a display preference, not a credential, and leaving it
 * readable lets client components pick it up without a round trip. Validated
 * against the known locales so an arbitrary cookie value cannot be written.
 */
export async function setLocaleAction(value: string): Promise<void> {
  if (!isLocale(value)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  // Every page renders translated chrome, so the whole tree is stale.
  revalidatePath("/", "layout");
}
