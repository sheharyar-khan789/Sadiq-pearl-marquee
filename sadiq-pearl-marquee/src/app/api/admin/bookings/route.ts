// POST /api/admin/bookings — staff-entered (walk-in / WhatsApp / phone / other)
// booking. Super Admin only. Uses the SAME engine transaction and slot locks
// as website requests; an optional existing customer account can be attached.
// No login credentials are ever created for offline customers.
import { validateManualBooking } from "@/lib/booking/admin";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { businessToday } from "@/lib/booking/dates";
import { createManualBooking } from "@/lib/booking/engine";
import { bookingReference } from "@/lib/booking/model";
import { profileStore } from "@/lib/booking/server";
import { loadConfigFresh } from "@/lib/config/config-server";

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const cfg = await loadConfigFresh();
    if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was saved." }, 503);
    const config = cfg.config;
    const v = validateManualBooking(body, businessToday(new Date()), config);
    if (!v.ok) return json({ error: "invalid_request", fields: v.errors }, 400);
    let email = v.value.email;
    if (v.value.customerId) {
      const profile = await profileStore()?.get(v.value.customerId);
      const known = profile ? true : (await store.listBookingsForCustomer(v.value.customerId, 1)).length > 0;
      if (!known) return failure("customer_not_found", 404);
      email = email ?? profile?.email ?? null;
    }
    const result = await createManualBooking(store, admin, { ...v.value, email }, { config });
    if (!result.ok) return failure(result.code === "invalid_request" ? "invalid_change" : result.code, result.code === "invalid_request" ? 400 : 409);
    return json(
      { ok: true, duplicate: result.duplicate, bookingId: result.booking.bookingId, reference: bookingReference(result.booking.bookingId) },
      result.duplicate ? 200 : 201
    );
  });
}
