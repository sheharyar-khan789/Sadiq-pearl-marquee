// POST /api/account/profile/sync — (re)creates the signed-in customer's own
// users/{uid} profile from the verified session cookie. Used by "Try again"
// and on sign-in state changes; the browser never writes the profile itself.
import { NextResponse, type NextRequest } from "next/server";
import { ensureProfileFromToken } from "@/lib/account/ensure-profile";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isSameOrigin } from "@/lib/auth/origin";
import { adminAuth, isAdminConfigured } from "@/lib/firebase/admin";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  if (!isAdminConfigured()) return json({ error: "profile_unavailable" }, 503);
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return json({ error: "unauthenticated" }, 401);

  let decoded;
  try {
    decoded = await adminAuth().verifySessionCookie(cookie, true);
  } catch {
    return json({ error: "unauthenticated" }, 401);
  }
  return (await ensureProfileFromToken(decoded)) ? json({ ok: true }) : json({ error: "profile_unavailable" }, 503);
}
