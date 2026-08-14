"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  translatorFor,
  type Locale,
  type Translator,
} from "@/lib/i18n";

/**
 * Makes the request's locale available to client components.
 *
 * Server components read the cookie directly via `getLocale()`. Client
 * components cannot, so the root layout resolves it once and passes it down —
 * one value through context rather than a prop threaded through every component
 * that happens to render a label.
 */

type LocaleContextValue = {
  locale: Locale;
  t: Translator;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: translatorFor(DEFAULT_LOCALE),
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, t: translatorFor(locale) }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Translator bound to the current locale, for client components. */
export function useT(): Translator {
  return useContext(LocaleContext).t;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}
