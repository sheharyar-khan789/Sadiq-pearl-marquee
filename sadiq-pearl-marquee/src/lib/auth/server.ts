// Server-side authentication & authorisation helpers — SERVER ONLY.
// The browser never decides who is signed in or who is an admin: every check
// here verifies the httpOnly session cookie with the Firebase Admin SDK.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SUPER_ADMIN_ROLE } from "./constants";

export type UserRole = "customer" | "super_admin";

export interface SessionUser {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  /** From a server-set custom claim only; defaults to "customer". */
  role: UserRole;
}

function toSessionUser(token: DecodedIdToken): SessionUser {
  return {
    uid: token.uid,
    email: token.email ?? null,
    name: typeof token.name === "string" ? token.name : null,
    emailVerified: token.email_verified === true,
    signInProvider: token.firebase?.sign_in_provider ?? null,
    role: token.role === SUPER_ADMIN_ROLE ? "super_admin" : "customer",
  };
}

/** Verifies a session cookie (signature, expiry and revocation). */
export async function verifySessionCookie(value: string | undefined): Promise<SessionUser | null> {
  if (!value || !isAdminConfigured()) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return toSessionUser(decoded);
  } catch {
    return null; // expired, revoked, malformed or for another project
  }
}

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return verifySessionCookie(store.get(SESSION_COOKIE)?.value);
});

/** Guard for customer routes (/account/*). Redirects to sign-in when needed. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/**
 * Guard for future admin routes (/admin/*). Non-admins get a 404 so the admin
 * area's existence is not revealed. The role comes only from a verified
 * custom claim, never from client state.
 */
export async function requireSuperAdmin(returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "super_admin" || !user.emailVerified) notFound();
  return user;
}

/**
 * Guard for admin API routes (Phase 5). Same-origin (CSRF) + verified session +
 * server-set super_admin claim + verified email. Returns the admin identity,
 * or the JSON error response to send: 403 cross-site, 401 no/expired session,
 * 403 not a Super Admin. The browser's own idea of its role is never consulted.
 */
export async function requireSuperAdminApi(
  request: Request
): Promise<{ ok: true; admin: { uid: string; email: string | null } } | { ok: false; status: 401 | 403; error: string }> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && !!host && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return { ok: false, status: 403, error: "forbidden" };
  const user = await getSessionUser();
  if (!user) return { ok: false, status: 401, error: "unauthenticated" };
  if (user.role !== "super_admin" || !user.emailVerified) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, admin: { uid: user.uid, email: user.email } };
}
