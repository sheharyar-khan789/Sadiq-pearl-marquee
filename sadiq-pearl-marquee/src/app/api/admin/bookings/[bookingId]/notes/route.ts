// POST /api/admin/bookings/{id}/notes  { adminNotes, expectedUpdatedAt? }
// Super Admin only. Admin notes are never included in any customer response.
import { adminUpdateNotes } from "@/lib/booking/admin";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (typeof body.adminNotes !== "string") return failure("invalid_notes", 400);
    const result = await adminUpdateNotes(store, admin, bookingId, body.adminNotes, {
      expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
    });
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : result.code === "invalid_notes" ? 400 : 409);
    return json({ ok: true });
  });
}
