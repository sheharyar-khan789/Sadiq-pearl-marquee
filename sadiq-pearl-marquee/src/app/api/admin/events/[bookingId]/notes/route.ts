// POST /api/admin/events/{bookingId}/notes  { action: "add", text } | { action: "edit", noteId, text }
// Super Admin only. Internal operational notes — never part of any customer response.
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { addOpsNote, editOpsNote } from "@/lib/booking/operations";
import { BOOKING_ID, checklistLabels, statusFor } from "@/lib/booking/operations-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!BOOKING_ID.test(bookingId)) return failure("not_found", 404);
    const labels = await checklistLabels();
    if (!labels) return json({ error: "database_error", message: "The business configuration couldn't be loaded. Nothing was changed." }, 503);
    const r =
      body.action === "add"
        ? await addOpsNote(store, admin, bookingId, body.text, { labels })
        : body.action === "edit"
          ? await editOpsNote(store, admin, bookingId, body.noteId, body.text, { labels })
          : ({ ok: false, code: "invalid_action" } as const);
    if (!r.ok) return failure(r.code, statusFor(r.code));
    return json({ ok: true });
  });
}
