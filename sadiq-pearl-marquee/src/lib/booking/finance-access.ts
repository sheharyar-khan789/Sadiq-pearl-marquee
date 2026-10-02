// Who may download which financial document (Phase 7). Pure logic, used by
// the PDF routes (via finance-server.ts) and the unit tests.
import type { PaymentRecord, QuotationRecord } from "./finance-model.ts";
import type { BookingStore } from "./store.ts";

/** The verified session user (from the session cookie, never the browser). */
export interface DocumentViewer {
  uid: string;
  role: "customer" | "super_admin";
  emailVerified: boolean;
}

const isAdmin = (u: DocumentViewer) => u.role === "super_admin" && u.emailVerified;

/**
 * A quotation the viewer may download: admins any; the customer only an
 * issued (or later superseded) quotation of THEIR OWN booking. Returns null
 * otherwise (the route answers 404, revealing nothing).
 */
export async function quotationForViewer(store: BookingStore, user: DocumentViewer, quotationId: string): Promise<QuotationRecord | null> {
  if (!/^qt_[0-9a-f]{32}$/.test(quotationId)) return null;
  const q = await store.getQuotation(quotationId);
  if (!q) return null;
  if (isAdmin(user)) return q;
  if (q.status !== "issued" && q.status !== "superseded") return null;
  if (!q.customerId || q.customerId !== user.uid) return null;
  const booking = await store.getBooking(q.bookingId);
  return booking && booking.customerId === user.uid ? q : null;
}

/** A payment (receipt) the viewer may download: admins any; the customer only their own booking's. */
export async function paymentForViewer(store: BookingStore, user: DocumentViewer, paymentId: string): Promise<PaymentRecord | null> {
  if (!/^pay_[0-9a-f]{24}$/.test(paymentId)) return null;
  const p = await store.getPayment(paymentId);
  if (!p) return null;
  if (isAdmin(user)) return p;
  if (!p.customerId || p.customerId !== user.uid) return null;
  const booking = await store.getBooking(p.bookingId);
  return booking && booking.customerId === user.uid ? p : null;
}
