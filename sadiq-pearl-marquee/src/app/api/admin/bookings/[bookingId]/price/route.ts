// POST /api/admin/bookings/{id}/price  { expectedUpdatedAt? }
// Super Admin only. Calculates the price of a booking that has NONE yet, with
// the one pricing engine and the current configuration. Existing prices are
// never recalculated (409 already_priced).
import { priceBooking } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { loadConfigFresh } from "@/lib/config/config-server";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
    const cfg = await loadConfigFresh();
    if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const result = await priceBooking(store, admin, bookingId, {
      config: cfg.config,
      expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
    });
    if (!result.ok) {
      if (result.code === "pricing_incomplete") {
        return json({ error: result.code, message: "Some prices this booking needs are not configured yet.", missing: result.missing }, 409);
      }
      return failure(result.code, result.code === "not_found" ? 404 : 409);
    }
    return json({ ok: true, total: result.booking.pricing?.total ?? null });
  });
}
