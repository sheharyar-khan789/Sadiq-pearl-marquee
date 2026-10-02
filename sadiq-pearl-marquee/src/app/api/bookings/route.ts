// Customer booking requests: POST /api/bookings
//
// Order of checks: same-origin (CSRF) -> verified session cookie -> verified
// email -> body validation -> engine transaction (availability + slot claim).
// The customer's identity comes only from the session; the body may contain
// only the fields listed in validation.ts (no IDs, statuses, prices, notes
// for staff or anything else), and prices are calculated on the server.
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/auth/origin";
import { getSessionUser } from "@/lib/auth/server";
import { businessToday } from "@/lib/booking/dates";
import { createCustomerBookingRequest } from "@/lib/booking/engine";
import { bookingReference } from "@/lib/booking/model";
import { loadConfigFresh } from "@/lib/config/config-server";
import { bookingStore, logBookingError, TimeoutError, withTimeout } from "@/lib/booking/server";
import { validateBookingRequest } from "@/lib/booking/validation";

const MAX_BODY_BYTES = 16 * 1024;
/** Security rule (not a business setting): a request holds a slot, so the email must be real. */
const REQUIRE_VERIFIED_EMAIL = true;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: "forbidden" }, 403);

  const store = bookingStore();
  if (!store) return json({ error: "booking_unavailable" }, 503);

  const user = await getSessionUser(); // verifies signature, expiry and revocation
  if (!user) return json({ error: "unauthenticated" }, 401);
  if (REQUIRE_VERIFIED_EMAIL && !user.emailVerified) return json({ error: "email_unverified" }, 403);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "invalid_request" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_request", fields: { body: { code: "invalid_body", message: "The request could not be read." } } }, 400);
  }

  // Current business configuration (capacity, slots, rules, prices). Fail closed.
  const cfg = await loadConfigFresh();
  if (!cfg.ok) return json({ error: "booking_unavailable" }, 503);
  const config = cfg.config;

  const now = new Date();
  const validation = validateBookingRequest(body, businessToday(now), config);
  if (!validation.ok) return json({ error: "invalid_request", fields: validation.errors }, 400);

  try {
    const result = await withTimeout(
      createCustomerBookingRequest(store, { uid: user.uid, email: user.email }, validation.value, { now, config }),
      15_000
    );
    if (!result.ok) {
      const status = result.code === "slot_unavailable" ? 409 : result.code === "too_many_open_requests" ? 429 : 400;
      return json({ error: result.code }, status);
    }
    const b = result.booking;
    return json(
      {
        ok: true,
        duplicate: result.duplicate,
        booking: {
          reference: bookingReference(b.bookingId),
          status: b.status,
          eventDate: b.eventDate,
          hallId: b.hallId,
          slotId: b.slotId,
        },
      },
      result.duplicate ? 200 : 201
    );
  } catch (error) {
    logBookingError("booking request", error);
    // A timed-out request may still have been saved; resubmitting the same
    // request key is safe and returns the saved booking instead of a new one.
    return json({ error: error instanceof TimeoutError ? "booking_timeout" : "booking_unavailable" }, 503);
  }
}
