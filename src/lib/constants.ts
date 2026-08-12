/** Shared constants that both middleware (edge) and server code need. */

export const ACTIVE_TEAM_COOKIE = "champio_team";

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
