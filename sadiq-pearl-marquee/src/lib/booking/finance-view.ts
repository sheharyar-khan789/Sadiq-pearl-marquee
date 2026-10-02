// Plain, serialisable views of payments and quotations for pages (Phase 7).
// The customer views are explicit allow-lists: internal notes, void reasons
// and staff identities never reach a customer page.
import {
  PAYMENT_METHOD_LABELS,
  QUOTATION_STATUS_LABELS,
  type PaymentMethod,
  type PaymentRecord,
  type PaymentStatus,
  type QuotationRecord,
  type QuotationStatus,
} from "./finance-model.ts";
import type { BookingRecord } from "./model.ts";

const iso = (d: Date | string) => new Date(d).toISOString();

export interface CustomerPaymentView {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  method: PaymentMethod;
  methodLabel: string;
  /** YYYY-MM-DD the money was received. */
  paidOn: string;
  status: PaymentStatus;
  remainingAfter: number;
  voidedAt: string | null;
}

export interface AdminPaymentView extends CustomerPaymentView {
  reference: string;
  notes: string;
  recordedAt: string;
  recordedBy: string;
  voidReason: string | null;
  voidedBy: string | null;
}

export function toCustomerPaymentView(p: PaymentRecord): CustomerPaymentView {
  return {
    paymentId: p.paymentId,
    receiptNumber: p.receipt.receiptNumber,
    amount: p.amount,
    method: p.method,
    methodLabel: PAYMENT_METHOD_LABELS[p.method] ?? p.method,
    paidOn: iso(p.paidAt).slice(0, 10),
    status: p.status,
    remainingAfter: p.receipt.remainingAfter,
    voidedAt: p.voided ? iso(p.voided.at) : null,
  };
}

export function toAdminPaymentView(p: PaymentRecord): AdminPaymentView {
  return {
    ...toCustomerPaymentView(p),
    reference: p.reference,
    notes: p.notes,
    recordedAt: iso(p.createdAt),
    recordedBy: p.recordedBy.email ?? p.recordedBy.uid,
    voidReason: p.voided?.reason ?? null,
    voidedBy: p.voided ? (p.voided.by.email ?? p.voided.by.uid) : null,
  };
}

export interface QuotationView {
  quotationId: string;
  number: string | null;
  status: QuotationStatus;
  statusLabel: string;
  createdAt: string;
  issuedAt: string | null;
  total: number;
  /** False when the booking's price changed after this quotation was made. */
  matchesBooking: boolean;
}

function toQuotationView(q: QuotationRecord, booking: Pick<BookingRecord, "pricing">): QuotationView {
  const p = booking.pricing;
  return {
    quotationId: q.quotationId,
    number: q.quotationNumber,
    status: q.status,
    statusLabel: QUOTATION_STATUS_LABELS[q.status],
    createdAt: iso(q.createdAt),
    issuedAt: q.issuedAt ? iso(q.issuedAt) : null,
    total: q.snapshot.pricing.total,
    matchesBooking:
      !!p && p.total === q.snapshot.pricing.total && iso(p.calculatedAt) === iso(q.snapshot.pricing.calculatedAt),
  };
}

/** Newest first. Admins see every quotation, including drafts and discarded ones. */
export function toAdminQuotationViews(list: QuotationRecord[], booking: Pick<BookingRecord, "pricing">): QuotationView[] {
  return list.map((q) => toQuotationView(q, booking)).reverse();
}

/** Newest first. Customers only see quotations that were issued to them. */
export function toCustomerQuotationViews(list: QuotationRecord[], booking: Pick<BookingRecord, "pricing">): QuotationView[] {
  return list
    .filter((q) => q.status === "issued" || q.status === "superseded")
    .map((q) => toQuotationView(q, booking))
    .reverse();
}
