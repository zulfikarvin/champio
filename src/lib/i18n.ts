/**
 * Minimal i18n seam.
 *
 * UI copy ships in English, but every user-facing string goes through `t()` so
 * that adding Bahasa Indonesia later is a matter of writing a second dictionary
 * and choosing a locale — not hunting literals across every component. No
 * framework yet: that would be weight we are not using.
 */

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const en = {
  "app.name": "Champio",
  "app.tagline": "Empowering the Next Generation of Champions",

  "nav.tracks": "Learning Tracks",
  "nav.proposals": "Proposals",
  "nav.library": "Reference Library",
  "nav.dashboard": "Dashboard",
  "nav.settings": "Settings",
  "nav.admin": "Admin",
  "nav.signOut": "Sign out",

  "auth.signIn": "Sign in",
  "auth.signUp": "Create account",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.fullName": "Full name",
  "auth.university": "University",
  "auth.haveAccount": "Already have an account?",
  "auth.noAccount": "New to Champio?",
  "auth.checkEmail": "Check your email to confirm your account.",

  "team.create": "Create a team",
  "team.name": "Team name",
  "team.switch": "Switch team",
  "team.members": "Members",
  "team.owner": "Owner",
  "team.member": "Member",
  "team.none": "You are not on a team yet.",
  "team.created": "Team created.",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.draft": "DRAFT",
} as const;

export type MessageKey = keyof typeof en;

/** Partial: a translation may lag behind `en` and falls back to it per key. */
const dictionaries: Record<Locale, Partial<Record<MessageKey, string>>> = {
  en,
  id: {},
};

/**
 * Looks up a string, with `{name}` interpolation.
 * Falls back to English, then to the key itself, so a missing translation
 * degrades to readable text rather than a blank UI.
 */
export function t(
  key: MessageKey,
  vars?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const template = dictionaries[locale][key] ?? en[key] ?? key;

  if (!vars) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
