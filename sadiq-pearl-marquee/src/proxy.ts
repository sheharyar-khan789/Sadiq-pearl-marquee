// Optimistic route protection (Next.js 16 "proxy", formerly middleware).
// It only checks that a session cookie is present, so visitors without one are
// redirected before any protected page renders. It is NOT the security
// boundary: every protected layout/route also verifies the cookie server-side
// with the Firebase Admin SDK (see src/lib/auth/server.ts).
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/** Header telling the customer-area layout which page to return to after sign-in. */
export const RETURN_TO_HEADER = "x-sp-return-to";

/** The separate admin sign-in page (email + password only). */
export const ADMIN_LOGIN_PATH = "/admin/login";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === ADMIN_LOGIN_PATH) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) {
    const headers = new Headers(request.headers);
    headers.set(RETURN_TO_HEADER, request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }
  // Admin and customer sign-in are separate flows.
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const login = new URL(isAdminArea ? ADMIN_LOGIN_PATH : "/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
