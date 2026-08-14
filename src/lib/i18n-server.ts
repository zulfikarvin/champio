import "server-only";

import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/constants";
import {
  DEFAULT_LOCALE,
  isLocale,
  translatorFor,
  type Locale,
  type Translator,
} from "@/lib/i18n";

/**
 * Locale for server components.
 *
 * Read from a plain cookie rather than a URL segment. A `/[locale]/…` route
 * would mean rewriting every href in the app and doubling the route tree, for a
 * two-language toggle whose value nobody needs to share by link.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** A translator bound to the request's locale. */
export async function getT(): Promise<Translator> {
  return translatorFor(await getLocale());
}
