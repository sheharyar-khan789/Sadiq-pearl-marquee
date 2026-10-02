// Payments, quotations and receipts (Phase 7) — data model.
//
//   payments/{paymentId}      one document per recorded (manual/offline)
//                             payment; carries its own immutable RECEIPT snapshot
//   quotations/{quotationId}  a snapshot of a booking's stored price, as
//                             generated / issued to the customer
//   counters/{name}           sequential document numbers (SPQ-/SPR-)
//
// All written ONLY by server code in transactions (Admin SDK). Documents and
// PDFs are rendered from these stored snapshots — never recalculated from the
// current business configuration — so they stay historically accurate.
import type { VenueTerm } from "../../data/policies.ts";
import type { PricingSnapshot } from "./pricing.ts";

export const PAYMENTS_COLLECTION = "payments";
export const QUOTATIONS_COLLECTION = "quotations";
export const COUNTERS_COLLECTION = "counters";
export const FINANCE_SCHEMA_VERSION = 1;

/** Manual / offline methods only (no online gateway exists). */
export const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  other: "Other",
};

/** Verified business details printed on documents (from src/lib/config.ts at the time of issue). */
export interface BusinessSnapshot {
  name: string;
  address: string;
  phones: string[];
}

export interface PartySnapshot {
  name: string;
  phone: string;
  email: string | null;
}

export interface EventSnapshot {
  date: string;
  slotLabel: string;
  hallName: string;
  eventTypeLabel: string;
  guestCount: number;
}

export interface ReceiptSnapshot {
  receiptNumber: string;
  business: BusinessSnapshot;
  bookingReference: string;
  /** Latest issued quotation at the time of payment, if any. */
  quotationNumber: string | null;
  customer: PartySnapshot;
  event: EventSnapshot;
  bookingTotal: number;
  paidBefore: number;
  paidAfter: number;
  remainingAfter: number;
  issuedAt: Date;
}

export type PaymentStatus = "recorded" | "voided";

export interface PaymentRecord {
  schemaVersion: number;
  paymentId: string;
  bookingId: string;
  customerId: string | null;
  amount: number;
  currency: "PKR";
  method: PaymentMethod;
  /** When the money was actually received (entered by staff). */
  paidAt: Date;
  reference: string;
  notes: string;
  /** "voided" = corrected by staff; the record and its receipt are kept. */
  status: PaymentStatus;
  recordedBy: { uid: string; email: string | null };
  voided: { at: Date; by: { uid: string; email: string | null }; reason: string } | null;
  receipt: ReceiptSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

/** draft: generated, visible to staff only · issued: shared with the customer ·
 *  superseded: replaced by a newer issued quotation · discarded: an unused draft. */
export const QUOTATION_STATUSES = ["draft", "issued", "superseded", "discarded"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export const QUOTATION_STATUS_LABELS: Readonly<Record<QuotationStatus, string>> = {
  draft: "Draft",
  issued: "Issued",
  superseded: "Superseded",
  discarded: "Discarded",
};

export interface QuotationSnapshot {
  business: BusinessSnapshot;
  bookingReference: string;
  customer: PartySnapshot;
  event: EventSnapshot;
  services: string[];
  menu: string | null;
  package: string | null;
  /** Copy of the booking's stored price (never recalculated). */
  pricing: PricingSnapshot;
  requiredAdvance: number | null;
  paidToDate: number;
  remaining: number;
  /** Published policies at the time of generation, if any. */
  policies: { cancellation: string; refund: string; modification: string; effectiveDate: string | null } | null;
  /** The official venue terms at the time of generation. Absent on quotations made before they were added. */
  terms?: VenueTerm[];
  generatedAt: Date;
}

export interface QuotationRecord {
  schemaVersion: number;
  quotationId: string;
  /** Assigned when issued (SPQ-YYYY-000001); null while a draft. */
  quotationNumber: string | null;
  bookingId: string;
  customerId: string | null;
  status: QuotationStatus;
  snapshot: QuotationSnapshot;
  createdBy: { uid: string; email: string | null };
  issuedBy: { uid: string; email: string | null } | null;
  createdAt: Date;
  issuedAt: Date | null;
  updatedAt: Date;
}

export interface CounterDoc {
  value: number;
}

/** Unpaid / partially paid / paid, from recorded payments; "pricing pending" without a price. */
export type FinancialStatus = "pricing_pending" | "unpaid" | "partially_paid" | "paid";
export const FINANCIAL_STATUS_LABELS: Readonly<Record<FinancialStatus, string>> = {
  pricing_pending: "Pricing pending",
  unpaid: "Unpaid",
  partially_paid: "Partially paid",
  paid: "Paid",
};

export interface FinancialSummary {
  status: FinancialStatus;
  total: number | null;
  requiredAdvance: number | null;
  paid: number;
  remaining: number | null;
  /** Required advance still outstanding (0 once covered). */
  advanceOutstanding: number | null;
}

/** Derived only from the booking's stored price and its recorded payments total. */
export function financialSummary(b: {
  pricing: Pick<PricingSnapshot, "total"> & { advanceRequired?: number | null } | null;
  payment?: { advanceRequired: number | null; advanceReceived: number } | null;
}): FinancialSummary {
  // advanceReceived = total of recorded, non-voided payments (see model.ts).
  const paid = b.payment?.advanceReceived ?? 0;
  if (!b.pricing) {
    return { status: "pricing_pending", total: null, requiredAdvance: null, paid, remaining: null, advanceOutstanding: null };
  }
  const total = b.pricing.total;
  const requiredAdvance = b.payment?.advanceRequired ?? b.pricing.advanceRequired ?? null;
  const remaining = total - paid;
  const status: FinancialStatus = paid <= 0 ? "unpaid" : remaining > 0 ? "partially_paid" : "paid";
  return {
    status,
    total,
    requiredAdvance,
    paid,
    remaining,
    advanceOutstanding: requiredAdvance === null ? null : Math.max(0, requiredAdvance - paid),
  };
}

/** Bookings that can take payments / quotations. Final "lost" states cannot. */
export function financiallyOpen(b: { status: string; holdExpiresAt: Date | string | null }, now: Date): boolean {
  if (b.status === "cancelled" || b.status === "rejected" || b.status === "expired") return false;
  // A pending request whose temporary hold has run out no longer holds its slot.
  if (b.status === "pending" && (!b.holdExpiresAt || new Date(b.holdExpiresAt).getTime() <= now.getTime())) return false;
  return true;
}

/** Customer-facing document number format (year in the business time zone). */
export const documentNumber = (prefix: "SPQ" | "SPR", year: string, n: number) => `${prefix}-${year}-${String(n).padStart(6, "0")}`;
