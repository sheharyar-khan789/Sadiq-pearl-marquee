// POST /api/admin/events/{bookingId}/vendors  { vendorId, category, notes? }
// Super Admin only. Assigns an existing vendor; refused (409 vendor_conflict)
// when the vendor is already on another active event in the same date + slot.
// No notification is sent to the vendor (Phase 9).
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { assignVendor } from "@/lib/booking/operations";
import { BOOKING_ID, statusFor } from "@/lib/booking/operations-api";
import { ADMIN_ERROR_MESSAGES } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!BOOKING_ID.test(bookingId)) return failure("not_found", 404);
    const r = await assignVendor(store, admin, bookingId, { vendorId: body.vendorId, category: body.category, notes: body.notes });
    if (!r.ok) {
      if (r.code === "vendor_conflict") {
        const refs = r.conflicts.map((c) => c.reference).join(", ");
        return json({ error: r.code, message: `${ADMIN_ERROR_MESSAGES.vendor_conflict} (${refs})`, conflicts: r.conflicts }, 409);
      }
      return failure(r.code, statusFor(r.code));
    }
    return json({ ok: true, assignmentId: r.assignment.assignmentId }, 201);
  });
}
