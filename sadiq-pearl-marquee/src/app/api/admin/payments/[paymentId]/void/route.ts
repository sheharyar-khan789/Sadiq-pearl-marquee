// POST /api/admin/payments/{id}/void  { reason }
// Super Admin only. Payments are never deleted or edited: a wrong entry is
// voided (kept, receipt marked VOID) and the booking totals are recalculated.
import { voidPayment } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^pay_[0-9a-f]{24}$/.test(paymentId)) return failure("not_found", 404);
    const result = await voidPayment(store, admin, paymentId, body.reason);
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : result.code === "invalid_reason" ? 400 : 409);
    return json({ ok: true });
  });
}
