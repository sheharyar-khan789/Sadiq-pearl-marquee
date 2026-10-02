// POST /api/account/bookings/{bookingId}/review  { rating, text, displayName }
// same-origin -> verified session -> validation -> transaction that checks the
// booking belongs to the session's customer and is completed. Creates or
// edits the customer's ONE review of that booking; it always (re)enters
// moderation ("pending") and is never published by this route.
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { rateLimit } from "@/lib/booking/rate-limit";
import { submitReview, validateReviewInput } from "@/lib/booking/reviews";
import { bookingStore, logBookingError, withTimeout } from "@/lib/booking/server";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const MESSAGES: Record<string, string> = {
  not_found: "Booking not found.",
  not_completed: "You can review your booking after the event has taken place.",
  no_change: "Nothing was changed.",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthenticated" }, 401);
  const store = bookingStore();
  if (!store) return json({ error: "unavailable" }, 503);
  if (!rateLimit(`review:${user.uid}`, 10, 60_000).ok) return json({ error: "rate_limited", message: "Too many attempts. Please wait a minute." }, 429);
  const { bookingId } = await params;
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 8 * 1024) return json({ error: "invalid_request" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const v = validateReviewInput(body);
  if (!v.ok) return json({ error: "invalid_review", message: Object.values(v.errors)[0]?.message, fields: v.errors }, 400);
  try {
    const r = await withTimeout(submitReview(store, user.uid, bookingId, v.value), 10_000);
    if (!r.ok) return json({ error: r.code, message: MESSAGES[r.code] }, r.code === "not_found" ? 404 : 409);
    return json({ ok: true, status: r.review.status, created: r.created }, r.created ? 201 : 200);
  } catch (error) {
    logBookingError("review submit", error);
    return json({ error: "unavailable", message: "Your review couldn't be saved. Please try again." }, 503);
  }
}
