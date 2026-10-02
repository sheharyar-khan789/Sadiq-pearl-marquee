// Customer change requests: POST /api/account/bookings/{bookingId}/requests
// body: { type: "modification" | "cancellation", changes?, reason?, requestKey }
//
// same-origin -> verified session -> body validation -> transaction that
// checks ownership + eligibility and stores the request. The booking itself,
// its status and its slot lock are never changed here.
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { submitChangeRequest, validateChangeRequest } from "@/lib/booking/customer";
import { businessToday } from "@/lib/booking/dates";
import { bookingStore, logBookingError, TimeoutError, withTimeout } from "@/lib/booking/server";
import { loadConfigFresh } from "@/lib/config/config-server";

const MAX_BODY_BYTES = 16 * 1024;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const store = bookingStore();
  if (!store) return json({ error: "booking_unavailable" }, 503);

  const user = await getSessionUser();
  if (!user) return json({ error: "unauthenticated" }, 401);

  const { bookingId } = await params;
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "invalid_request" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_request", fields: { body: { code: "invalid_body", message: "The request could not be read." } } }, 400);
  }

  const cfg = await loadConfigFresh();
  if (!cfg.ok) return json({ error: "booking_unavailable" }, 503);
  const now = new Date();
  const validation = validateChangeRequest(body, businessToday(now), cfg.config);
  if (!validation.ok) return json({ error: "invalid_request", fields: validation.errors }, 400);

  try {
    const result = await withTimeout(submitChangeRequest(store, { uid: user.uid }, bookingId, validation.value, { now }), 15_000);
    if (!result.ok) {
      const status = { not_found: 404, not_allowed: 409, request_exists: 409, no_changes: 400 }[result.code];
      return json({ error: result.code }, status);
    }
    const r = result.request;
    return json(
      {
        ok: true,
        duplicate: result.duplicate,
        request: { type: r.type, status: r.status, requestedSlotState: r.requestedSlot?.stateAtRequest ?? null },
      },
      result.duplicate ? 200 : 201
    );
  } catch (error) {
    logBookingError("change request", error);
    return json({ error: error instanceof TimeoutError ? "request_timeout" : "booking_unavailable" }, 503);
  }
}
