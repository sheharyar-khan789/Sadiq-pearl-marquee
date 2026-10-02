// POST /api/admin/bookings/{id}/quotations  { expectedUpdatedAt? }
// Super Admin only. Drafts a quotation from the booking's STORED price
// snapshot (no recalculation). An older unissued draft is discarded.
import { generateQuotation } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { businessSnapshot } from "@/lib/booking/finance-server";
import { loadConfigFresh } from "@/lib/config/config-server";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
    // Only the published policies are read from the configuration (copied into the draft).
    const cfg = await loadConfigFresh();
    if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const result = await generateQuotation(store, admin, bookingId, {
      config: cfg.config,
      business: businessSnapshot(),
      expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
    });
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : 409);
    return json({ ok: true, quotationId: result.quotation.quotationId }, 201);
  });
}
