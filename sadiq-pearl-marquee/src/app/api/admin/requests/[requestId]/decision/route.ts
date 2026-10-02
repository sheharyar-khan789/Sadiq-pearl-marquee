// POST /api/admin/requests/{id}/decision  { decision: "approve" | "reject", reason?, expectedBookingUpdatedAt? }
// Super Admin only. Approving a date/slot change claims the new slot, updates
// the booking and releases the old slot in ONE transaction; if the new slot is
// taken, nothing changes (409 slot_unavailable).
import { decideRequest } from "@/lib/booking/admin";
import { adminMutation, failure, json, optionalString } from "@/lib/booking/admin-api";
import { loadConfigFresh } from "@/lib/config/config-server";

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^rq_[0-9a-f]{24}$/.test(requestId)) return failure("not_found", 404);
    const cfg = await loadConfigFresh();
    if (!cfg.ok) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const result = await decideRequest(store, admin, requestId, body.decision, {
      reason: optionalString(body.reason, 1000),
      expectedBookingUpdatedAt: typeof body.expectedBookingUpdatedAt === "string" ? body.expectedBookingUpdatedAt : undefined,
      config: cfg.config,
    });
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : result.code === "invalid_decision" ? 400 : 409);
    return json({ ok: true, requestStatus: result.request.status, bookingStatus: result.booking.status });
  });
}
