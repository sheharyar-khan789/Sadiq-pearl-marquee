// POST /api/admin/bookings/{id}/payments  { amount, method, paidOn, reference, notes, requestKey }
// Super Admin only. Records a manual / offline payment. The amount is checked
// against the remaining balance INSIDE the transaction (409 overpayment); a
// repeated submission (same requestKey) returns the already-recorded payment.
// Totals, balance and receipt data are calculated here, never taken from the browser.
import { recordPayment, validatePaymentInput } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { businessToday } from "@/lib/booking/dates";
import { businessSnapshot } from "@/lib/booking/finance-server";

export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return failure("not_found", 404);
    const input = validatePaymentInput(body, businessToday(new Date()));
    if (!input.ok) {
      const first = Object.values(input.errors)[0]?.message;
      return json({ error: "invalid_payment", message: first ?? "Please correct the payment details.", fields: input.errors }, 400);
    }
    const result = await recordPayment(store, admin, bookingId, input.value, { business: businessSnapshot() });
    if (!result.ok) {
      if (result.code === "overpayment") {
        return json(
          {
            error: "overpayment",
            message: `The amount is more than the remaining balance (Rs ${result.remaining.toLocaleString("en-PK")}). Nothing was recorded.`,
            remaining: result.remaining,
          },
          409
        );
      }
      return failure(result.code, result.code === "not_found" ? 404 : 409);
    }
    return json(
      {
        ok: true,
        replayed: result.replayed,
        paymentId: result.payment.paymentId,
        receiptNumber: result.payment.receipt.receiptNumber,
        remaining: result.payment.receipt.remainingAfter,
      },
      result.replayed ? 200 : 201
    );
  });
}
