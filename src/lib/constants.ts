/** Shared constants that both middleware (edge) and server code need. */

export const ACTIVE_TEAM_COOKIE = "champio_team";

/** Chosen interface language. A preference, readable by both server and client. */
export const LOCALE_COOKIE = "champio_locale";

/** Routes that require a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/proposals",
  "/tracks",
  "/library",
  "/settings",
  "/admin",
] as const;

/** Routes a signed-in user should be bounced away from. */
export const AUTH_ROUTES = ["/login", "/signup"] as const;
