// Shared, non-secret auth constants (safe to import from proxy, server and client code).

/** httpOnly session cookie set by /api/auth/session. "__session" is the one
 *  cookie name Firebase Hosting forwards to server code. */
export const SESSION_COOKIE = "__session";

/** Session length: 5 days (Firebase allows 5 minutes – 14 days). */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;

/** Custom-claim value that marks the venue's Super Admin. Only ever set
 *  server-side by scripts/set-super-admin.mjs; never read from client input. */
export const SUPER_ADMIN_ROLE = "super_admin";

/** Where signed-in customers land by default. */
export const DEFAULT_SIGNED_IN_PATH = "/account";

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_SIGNED_IN_PATH): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.startsWith("/login") || next.startsWith("/signup") || next.startsWith("/api/")) return fallback;
  return next;
}
