// POST /api/admin/events/{bookingId}/checklist
//   { action: "update", itemId, status?, note? } | { action: "add", label } | { action: "sync" }
// Super Admin only. Operational checklist changes never touch the booking,
// its slot, its price or any payment / quotation / receipt.
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { addChecklistItem, syncChecklistWithBooking, updateChecklistItem } from "@/lib/booking/operations";
import { BOOKING_ID, checklistLabels, statusFor } from "@/lib/booking/operations-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!BOOKING_ID.test(bookingId)) return failure("not_found", 404);
    const labels = await checklistLabels();
    if (!labels) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const r =
      body.action === "update"
        ? await updateChecklistItem(store, admin, bookingId, body.itemId, { status: body.status, note: body.note }, { labels })
        : body.action === "add"
          ? await addChecklistItem(store, admin, bookingId, body.label, { labels })
          : body.action === "sync"
            ? await syncChecklistWithBooking(store, admin, bookingId, { labels })
            : ({ ok: false, code: "invalid_action" } as const);
    if (!r.ok) return failure(r.code, statusFor(r.code));
    return json({ ok: true });
  });
}
