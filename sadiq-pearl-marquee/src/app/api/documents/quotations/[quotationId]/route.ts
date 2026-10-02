// GET /api/documents/quotations/{id}  -> PDF
// The Super Admin may download any quotation; a customer only an issued (or
// superseded) quotation of their own booking. Everyone else gets 404.
// The PDF is rendered from the stored snapshot only.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { quotationPdf } from "@/lib/booking/documents-pdf";
import { documentLogo, quotationForViewer } from "@/lib/booking/finance-server";
import { bookingStore, logBookingError, withTimeout } from "@/lib/booking/server";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: noStore });
  const store = bookingStore();
  if (!store) return NextResponse.json({ error: "documents_unavailable" }, { status: 503, headers: noStore });
  try {
    const q = await withTimeout(quotationForViewer(store, user, quotationId), 10_000);
    if (!q) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
    const pdf = await quotationPdf(q, await documentLogo());
    const name = (q.quotationNumber ?? `draft-${q.snapshot.bookingReference}`).replace(/[^A-Za-z0-9-]/g, "");
    return new Response(Buffer.from(pdf), {
      headers: {
        ...noStore,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="quotation-${name}.pdf"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logBookingError("quotation pdf", error);
    return NextResponse.json({ error: "documents_unavailable" }, { status: 503, headers: noStore });
  }
}
