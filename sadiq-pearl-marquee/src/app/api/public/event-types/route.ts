// GET /api/public/event-types -> { eventTypes: [{ id, name }] }
// The ACTIVE event types from the stored business configuration (the same
// list the booking system uses), for the public WhatsApp inquiry form. Public,
// read-only, no customer data. Served from the short public-configuration
// cache (cleared on every admin save in this process; see config-server.ts).
import { NextResponse } from "next/server";
import { loadPublicConfig } from "@/lib/config/config-server";
import { bookingStore } from "@/lib/booking/server";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!bookingStore()) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  const cfg = await loadPublicConfig();
  if (!cfg.ok) return NextResponse.json({ error: "unavailable" }, { status: 503, headers });
  // toPublicConfig already keeps only active event types, in their configured order.
  return NextResponse.json({ eventTypes: cfg.config.eventTypes.map((e) => ({ id: e.id, name: e.name })) }, { headers });
}
