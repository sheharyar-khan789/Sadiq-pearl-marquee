// Public slot availability: GET /api/availability?hall=main-hall&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns only free / held / booked per slot, never booking or customer details.
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_HALL_ID } from "@/lib/booking/catalog";
import { getAvailability } from "@/lib/booking/engine";
import { bookingStore, logBookingError, withTimeout } from "@/lib/booking/server";
import { loadPublicConfig } from "@/lib/config/config-server";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const store = bookingStore();
  if (!store) return json({ error: "booking_unavailable" }, 503);

  const cfg = await loadPublicConfig();
  if (!cfg.ok) return json({ error: "booking_unavailable" }, 503);

  try {
    const result = await withTimeout(
      getAvailability(store, params.get("hall") ?? DEFAULT_HALL_ID, params.get("from") ?? "", params.get("to") ?? "", {
        config: cfg.config,
      }),
      10_000
    );
    if (!result.ok) return json({ error: result.code }, 400);
    return json(result.availability);
  } catch (error) {
    logBookingError("availability", error);
    return json({ error: "booking_unavailable" }, 503);
  }
}
