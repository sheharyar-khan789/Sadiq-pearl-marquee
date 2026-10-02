// POST /api/admin/vendor-assignments/{id}  { status: "confirmed" | "cancelled" }
// Super Admin only. "cancelled" = unassigned (kept for history, never deleted).
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { setAssignmentStatus } from "@/lib/booking/operations";
import { statusFor } from "@/lib/booking/operations-api";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^va_[0-9a-f]{24}$/.test(assignmentId)) return failure("not_found", 404);
    const r = await setAssignmentStatus(store, admin, assignmentId, body.status);
    if (!r.ok) return failure(r.code, statusFor(r.code));
    return json({ ok: true });
  });
}
