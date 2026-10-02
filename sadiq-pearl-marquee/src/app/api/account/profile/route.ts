// Customer profile update: PATCH /api/account/profile  body: { name, phone }
// Only the signed-in customer's own profile (uid from the verified session).
// Role, uid, email, verification and timestamps cannot be sent (rejected).
import { NextResponse, type NextRequest } from "next/server";
import { validateProfileUpdate } from "@/lib/account/profile";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { adminAuth } from "@/lib/firebase/admin";
import { logBookingError, profileStore, TimeoutError, withTimeout } from "@/lib/booking/server";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const profiles = profileStore();
  if (!profiles) return json({ error: "profile_unavailable" }, 503);

  const user = await getSessionUser();
  if (!user) return json({ error: "unauthenticated" }, 401);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ error: "invalid_request" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_request", fields: { body: { code: "invalid_body", message: "The request could not be read." } } }, 400);
  }
  const validation = validateProfileUpdate(body);
  if (!validation.ok) return json({ error: "invalid_request", fields: validation.errors }, 400);

  try {
    const saved = await withTimeout(
      profiles.update(
        { uid: user.uid, email: user.email, emailVerified: user.emailVerified, signInProvider: user.signInProvider },
        validation.value
      ),
      10_000
    );
    // Keep the Firebase Auth display name in step (shown after the next sign-in).
    await withTimeout(adminAuth().updateUser(user.uid, { displayName: validation.value.name }), 10_000).catch((error) =>
      logBookingError("display name update", error)
    );
    return json({ ok: true, profile: { name: saved.name, phone: saved.phone } });
  } catch (error) {
    logBookingError("profile update", error);
    return json({ error: error instanceof TimeoutError ? "profile_timeout" : "profile_unavailable" }, 503);
  }
}
