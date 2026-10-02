// POST /api/account/notifications/read  { notificationId } | { all: true }
// same-origin -> verified session -> ownership checked in a transaction.
// The customer can only set "read" on their OWN notifications; nothing else
// about a notification can be changed through any API.
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/booking/communications";
import { rateLimit } from "@/lib/booking/rate-limit";
import { bookingStore, logBookingError, withTimeout } from "@/lib/booking/server";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthenticated" }, 401);
  const store = bookingStore();
  if (!store) return json({ error: "unavailable" }, 503);
  if (!rateLimit(`read:${user.uid}`, 60, 60_000).ok) return json({ error: "rate_limited" }, 429);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 2048) return json({ error: "invalid_request" }, 413);
    const parsed = JSON.parse(text || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    body = parsed;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (Object.keys(body).some((k) => k !== "notificationId" && k !== "all")) return json({ error: "invalid_request" }, 400);
  try {
    if (body.all === true) {
      const r = await withTimeout(markAllNotificationsRead(store, user.uid), 10_000);
      return json({ ok: true, count: r.count });
    }
    const r = await withTimeout(markNotificationRead(store, user.uid, body.notificationId), 10_000);
    if (!r.ok) return json({ error: "not_found" }, 404);
    return json({ ok: true });
  } catch (error) {
    logBookingError("notifications read", error);
    return json({ error: "unavailable", message: "Couldn't update notifications. Please try again." }, 503);
  }
}
