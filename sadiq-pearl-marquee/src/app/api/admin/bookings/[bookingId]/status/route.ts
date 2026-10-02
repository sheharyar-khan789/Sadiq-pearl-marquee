// POST /api/admin/bookings/{id}/status  { to, reason?, expectedUpdatedAt? }
// Super Admin only. Transition rules, slot re-check and audit happen in one
// transaction (src/lib/booking/engine.ts changeBookingStatus).
import { adminSetStatus } from "@/lib/booking/admin";
import { adminMutation, failure, json, optionalString } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    const result = await adminSetStatus(store, admin, bookingId, body.to, {
      reason: optionalString(body.reason, 1000),
      expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
    });
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : result.code === "invalid_action" ? 400 : 409);
    return json({ ok: true, status: result.booking.status });
  });
}
