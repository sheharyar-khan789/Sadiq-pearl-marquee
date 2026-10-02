// GET /api/documents/receipts/{paymentId}  -> PDF
// The Super Admin may download any receipt; a customer only receipts of their
// own booking. Everyone else gets 404. Rendered from the stored receipt
// snapshot only; a voided payment's receipt is marked VOID.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { receiptPdf } from "@/lib/booking/documents-pdf";
import { documentLogo, paymentForViewer } from "@/lib/booking/finance-server";
import { bookingStore, logBookingError, withTimeout } from "@/lib/booking/server";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: noStore });
  const store = bookingStore();
  if (!store) return NextResponse.json({ error: "documents_unavailable" }, { status: 503, headers: noStore });
  try {
    const p = await withTimeout(paymentForViewer(store, user, paymentId), 10_000);
    if (!p) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    const pdf = await receiptPdf(p, await documentLogo());
    const name = p.receipt.receiptNumber.replace(/[^A-Za-z0-9-]/g, "");
    return new Response(Buffer.from(pdf), {
      headers: {
        ...noStore,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="receipt-${name}.pdf"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logBookingError("receipt pdf", error);
    return NextResponse.json({ error: "documents_unavailable" }, { status: 503, headers: noStore });
  }
}
