// POST /api/admin/events/{bookingId}/status  { to: OpsStatus }
// Super Admin only. Changes the OPERATIONAL status (not the booking status).
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { setOpsStatus } from "@/lib/booking/operations";
import { BOOKING_ID, checklistLabels, statusFor } from "@/lib/booking/operations-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!BOOKING_ID.test(bookingId)) return failure("not_found", 404);
    const labels = await checklistLabels();
    if (!labels) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const r = await setOpsStatus(store, admin, bookingId, body.to, { labels });
    if (!r.ok) return failure(r.code, statusFor(r.code));
    return json({ ok: true, status: r.operations.status });
  });
}
