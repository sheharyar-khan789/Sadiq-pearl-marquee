// Exchanges a Firebase ID token for an httpOnly session cookie (POST) and
// clears it (DELETE). Server-side route protection reads only this cookie.
import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";

const RECENT_SIGN_IN_SECONDS = 5 * 60;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Who is signed in, for the public navbar (which is static and can't read the
 * httpOnly cookie). Only the display name and email of the caller's own
 * verified session; never the role, so admin status isn't exposed publicly.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ signedIn: false });
  return json({ signedIn: true, name: user.name, email: user.email });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!isAdminConfigured()) return json({ error: "auth_unavailable" }, 503);

  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 8192) {
    return json({ error: "bad_request" }, 400);
  }

  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(idToken, true);

    // Only mint a session right after a real sign-in, or to refresh an
    // existing valid session for the same user (e.g. after email verification).
    let allowed = Date.now() / 1000 - decoded.auth_time < RECENT_SIGN_IN_SECONDS;
    if (!allowed) {
      const existing = request.cookies.get(SESSION_COOKIE)?.value;
      if (existing) {
        try {
          allowed = (await auth.verifySessionCookie(existing, true)).uid === decoded.uid;
        } catch {
          allowed = false;
        }
      }
    }
    if (!allowed) return json({ error: "recent_sign_in_required" }, 401);

    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
    const response = json({ ok: true, emailVerified: decoded.email_verified === true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, cookieOptions(SESSION_MAX_AGE_SECONDS));
    return response;
  } catch (error) {
    const code = (error as { code?: string }).code ?? "unknown";
    console.error(`[auth/session] session creation failed: ${code}`);
    return json({ error: "invalid_token" }, 401);
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  // Session cookies are stateless, so clearing this browser's copy alone would
  // leave any copied cookie valid until it expires. Revoking the user's refresh
  // tokens invalidates every session cookie for the account (checkRevoked), i.e.
  // sign-out ends the session everywhere.
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  if (existing && isAdminConfigured()) {
    try {
      const auth = adminAuth();
      const { uid, auth_time } = await auth.verifySessionCookie(existing, false);
      // Firebase records revocation to the whole second, and a session whose
      // sign-in happened in that same second would still count as valid. If
      // this session is that fresh, wait until the next second (at most ~1 s)
      // so the revocation is guaranteed to cover it.
      const waitMs = (auth_time + 1) * 1000 - Date.now();
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 1100)));
      await auth.revokeRefreshTokens(uid);
    } catch (error) {
      // Already invalid/expired: nothing to revoke. Other failures are logged.
      const code = (error as { code?: string }).code ?? "unknown";
      if (!code.includes("session-cookie")) console.error(`[auth/session] sign-out revocation failed: ${code}`);
    }
  }

  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
