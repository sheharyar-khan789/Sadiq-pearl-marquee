// Payments, quotations and receipts (Phase 7) — SERVER ONLY in use.
//
// Every function expects the caller (an admin API route) to have verified the
// Super Admin from the session; `actor` is that verified identity. Each change
// runs in ONE transaction together with its audit record:
//  - recordPayment: reads the booking and ALL its payments, re-checks the
//    amount against the remaining balance, then writes the payment (with its
//    receipt snapshot and number), the booking's paid totals, the receipt
//    counter and the audit record. Two admins recording at the same time
//    cannot both pass the balance check: the second transaction sees the
//    first one's changes (retry) and is re-validated.
//  - voidPayment: payments are never deleted or edited; a mistake is voided
//    with a reason and the totals are recalculated from the remaining payments.
//  - quotations are snapshots of the booking's STORED price (pricing.ts is the
//    only price calculator); issued quotations are never changed again.
// No value that affects money is taken from the browser except the payment
// amount itself (validated here) and descriptive fields.
import { randomUUID, createHash } from "node:crypto";
import { DEFAULT_CONFIG, type BusinessConfig } from "../config/business-config.ts";
import { OFFICIAL_VENUE_TERMS } from "../../data/policies.ts";
import { businessToday, isIsoDate } from "./dates.ts";
import { auditRecord } from "./engine.ts";
import {
  documentNumber,
  FINANCE_SCHEMA_VERSION,
  financiallyOpen,
  PAYMENT_METHODS,
  type BusinessSnapshot,
  type EventSnapshot,
  type PartySnapshot,
  type PaymentMethod,
  type PaymentRecord,
  type QuotationRecord,
  type QuotationSnapshot,
} from "./finance-model.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import { quote } from "./pricing.ts";
import type { AdminActor, AuditRecord } from "./audit-model.ts";
import type { BookingStore } from "./store.ts";
import { notifyInTransaction } from "./notifications.ts";

/** Highest single payment accepted (sanity bound; real limit is the balance). */
export const MAX_PAYMENT_AMOUNT = 100_000_000;
export const PAYMENT_REFERENCE_MAX = 120;
export const PAYMENT_NOTES_MAX = 1000;
export const VOID_REASON_MIN = 3;
export const VOID_REASON_MAX = 500;
const REQUEST_KEY = /^[A-Za-z0-9_-]{16,80}$/;

type Actor = AdminActor;
const actorOf = (a: Actor) => ({ uid: a.uid, email: a.email ?? null });


const recordedTotal = (payments: PaymentRecord[]) =>
  payments.filter((p) => p.status === "recorded").reduce((sum, p) => sum + p.amount, 0);

const partyOf = (b: BookingRecord): PartySnapshot => ({ name: b.customer.name, phone: b.customer.phone, email: b.customer.email });
const eventOf = (b: BookingRecord): EventSnapshot => ({
  date: b.eventDate,
  slotLabel: b.slotLabel,
  hallName: b.hallName,
  eventTypeLabel: b.eventTypeLabel,
  guestCount: b.guestCount,
});

const financeAudit = (
  action: AuditRecord["action"],
  actor: Actor,
  bookingId: string,
  now: Date,
  entity: { type: "payment" | "quotation" | null; id: string | null },
  extra: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; reason?: string }
): AuditRecord => {
  const record = auditRecord(action, actor, bookingId, now, extra);
  return entity.type ? { ...record, entityType: entity.type, entityId: entity.id ?? "" } : record;
};

/** Sequential document number, allocated inside the caller's transaction. */
async function nextNumber(tx: Parameters<Parameters<BookingStore["runTransaction"]>[0]>[0], prefix: "SPQ" | "SPR", now: Date) {
  const year = businessToday(now).slice(0, 4);
  const name = `${prefix === "SPQ" ? "quotation" : "receipt"}-${year}`;
  const counter = await tx.getCounter(name);
  const value = (counter?.data.value ?? 0) + 1;
  return { number: documentNumber(prefix, year, value), commit: () => tx.putCounter(name, value, counter?.version ?? null) };
}

// ------------------------------------------------------------------ pricing

export type PriceResult =
  | { ok: true; booking: BookingRecord }
  | { ok: false; code: "not_found" | "already_priced" | "not_allowed" | "stale" | "total_below_paid" }
  | { ok: false; code: "pricing_incomplete"; missing: string[] };

/**
 * Calculates the price of a booking that has none yet (created before prices
 * were configured) with the one pricing engine, quote(), and the CURRENT
 * configuration. An existing price is never recalculated here.
 */
export async function priceBooking(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  options: { now?: Date; config?: BusinessConfig; expectedUpdatedAt?: string } = {}
): Promise<PriceResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  return store.runTransaction(async (tx): Promise<PriceResult> => {
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    if (options.expectedUpdatedAt && new Date(b.updatedAt).toISOString() !== options.expectedUpdatedAt) {
      return { ok: false, code: "stale" };
    }
    if (b.pricing) return { ok: false, code: "already_priced" };
    if (!financiallyOpen(b, now)) return { ok: false, code: "not_allowed" };
    const q = quote(
      config,
      {
        hallId: b.hallId,
        guestCount: b.guestCount,
        serviceIds: b.services.map((s) => s.id),
        menuId: b.menuPreference?.id ?? null,
        packageId: b.package?.id ?? null,
      },
      now
    );
    if (q.status !== "priced") return { ok: false, code: "pricing_incomplete", missing: q.missing };
    const payments = await tx.listPaymentsForBooking(bookingId);
    const paid = recordedTotal(payments);
    if (q.snapshot.total < paid) return { ok: false, code: "total_below_paid" };
    const payment = {
      currency: "PKR" as const,
      advanceRequired: q.snapshot.advanceRequired,
      advanceReceived: paid,
      balanceDue: q.snapshot.total - paid,
      paymentCount: payments.filter((p) => p.status === "recorded").length,
    };
    tx.updateBooking(bookingId, { pricing: q.snapshot, payment, updatedAt: now }, found.version);
    tx.createAudit(
      financeAudit("booking_priced", actor, bookingId, now, { type: null, id: null }, {
        before: { priced: false },
        after: { total: q.snapshot.total, advanceRequired: q.snapshot.advanceRequired, configVersion: q.snapshot.configVersion },
      })
    );
    return { ok: true, booking: { ...b, pricing: q.snapshot, payment, updatedAt: now } };
  });
}

// ----------------------------------------------------------------- payments

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  /** Date the money was received (YYYY-MM-DD, venue time zone). */
  paidOn: string;
  reference: string;
  notes: string;
  requestKey: string;
}

export type PaymentFieldErrors = Partial<Record<keyof PaymentInput | "body", { code: string; message: string }>>;

const PAYMENT_FIELDS = ["amount", "method", "paidOn", "reference", "notes", "requestKey"];

/** Server-side validation of the payment form. Unknown fields are refused. */
export function validatePaymentInput(
  raw: unknown,
  today: string
): { ok: true; value: PaymentInput } | { ok: false; errors: PaymentFieldErrors } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const errors: PaymentFieldErrors = {};
  const extra = Object.keys(body).find((k) => !PAYMENT_FIELDS.includes(k));
  if (extra) errors.body = { code: "unexpected_field", message: `Unexpected field: ${extra.slice(0, 40)}` };

  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    errors.amount = { code: "invalid_amount", message: "Enter the amount received in whole rupees (more than 0)." };
  } else if (amount > MAX_PAYMENT_AMOUNT) {
    errors.amount = { code: "invalid_amount", message: "This amount is too large." };
  }
  if (!(PAYMENT_METHODS as readonly unknown[]).includes(body.method)) {
    errors.method = { code: "invalid_method", message: "Choose how the payment was received." };
  }
  if (!isIsoDate(body.paidOn)) {
    errors.paidOn = { code: "invalid_date", message: "Enter the date the payment was received." };
  } else if (body.paidOn > today) {
    errors.paidOn = { code: "future_date", message: "The payment date can't be in the future." };
  }
  const text = (key: "reference" | "notes", max: number) => {
    const v = body[key] ?? "";
    if (typeof v !== "string" || v.length > max) {
      errors[key] = { code: `invalid_${key}`, message: `Keep this under ${max} characters.` };
      return "";
    }
    return v.trim();
  };
  const reference = text("reference", PAYMENT_REFERENCE_MAX);
  const notes = text("notes", PAYMENT_NOTES_MAX);
  if (typeof body.requestKey !== "string" || !REQUEST_KEY.test(body.requestKey)) {
    errors.requestKey = { code: "invalid_request_key", message: "Please reload the page and try again." };
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      amount: amount as number,
      method: body.method as PaymentMethod,
      paidOn: body.paidOn as string,
      reference,
      notes,
      requestKey: body.requestKey as string,
    },
  };
}

/** Same admin + same form submission => same payment ID (a retried request never records twice). */
export function derivePaymentId(adminUid: string, requestKey: string): string {
  return `pay_${createHash("sha256").update(`payment\n${adminUid}\n${requestKey}`).digest("hex").slice(0, 24)}`;
}

export type RecordPaymentResult =
  | { ok: true; payment: PaymentRecord; replayed: boolean }
  | {
      ok: false;
      code: "not_found" | "booking_inactive" | "pricing_pending" | "already_paid" | "duplicate_request";
    }
  | { ok: false; code: "overpayment"; remaining: number };

export async function recordPayment(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  input: PaymentInput,
  options: { now?: Date; business: BusinessSnapshot }
): Promise<RecordPaymentResult> {
  const now = options.now ?? new Date();
  const paymentId = derivePaymentId(actor.uid, input.requestKey);
  return store.runTransaction(async (tx): Promise<RecordPaymentResult> => {
    // --- reads ---
    const existing = await tx.getPayment(paymentId);
    if (existing) {
      // The same submission arriving twice (double click, network retry).
      if (existing.data.bookingId === bookingId && existing.data.amount === input.amount) {
        return { ok: true, payment: existing.data, replayed: true };
      }
      return { ok: false, code: "duplicate_request" };
    }
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    if (!financiallyOpen(b, now)) return { ok: false, code: "booking_inactive" };
    if (!b.pricing) return { ok: false, code: "pricing_pending" };
    const payments = await tx.listPaymentsForBooking(bookingId);
    const quotations = await tx.listQuotationsForBooking(bookingId);
    const paidBefore = recordedTotal(payments);
    const total = b.pricing.total;
    const remaining = total - paidBefore;
    if (remaining <= 0) return { ok: false, code: "already_paid" };
    if (input.amount > remaining) return { ok: false, code: "overpayment", remaining };
    const receiptNo = await nextNumber(tx, "SPR", now);

    // --- writes (all or nothing) ---
    const paidAfter = paidBefore + input.amount;
    const issued = quotations.filter((q) => q.status === "issued").at(-1);
    const payment: PaymentRecord = {
      schemaVersion: FINANCE_SCHEMA_VERSION,
      paymentId,
      bookingId,
      customerId: b.customerId,
      amount: input.amount,
      currency: "PKR",
      method: input.method,
      // Noon at the venue (UTC+5) keeps the calendar date stable in any display zone.
      paidAt: new Date(`${input.paidOn}T07:00:00.000Z`),
      reference: input.reference,
      notes: input.notes,
      status: "recorded",
      recordedBy: actorOf(actor),
      voided: null,
      receipt: {
        receiptNumber: receiptNo.number,
        business: options.business,
        bookingReference: bookingReference(bookingId),
        quotationNumber: issued?.quotationNumber ?? null,
        customer: partyOf(b),
        event: eventOf(b),
        bookingTotal: total,
        paidBefore,
        paidAfter,
        remainingAfter: total - paidAfter,
        issuedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    };
    tx.createPayment(payment);
    tx.updateBooking(
      bookingId,
      {
        payment: {
          ...b.payment,
          advanceReceived: paidAfter,
          balanceDue: total - paidAfter,
          paymentCount: payments.filter((p) => p.status === "recorded").length + 1,
        },
        updatedAt: now,
      },
      found.version
    );
    receiptNo.commit();
    notifyInTransaction(
      tx,
      { type: "PAYMENT_RECEIVED", paymentId, receiptNumber: receiptNo.number, amount: input.amount, remaining: total - paidAfter },
      b,
      now
    );
    tx.createAudit(
      financeAudit("payment_recorded", actor, bookingId, now, { type: "payment", id: paymentId }, {
        before: { paid: paidBefore, remaining },
        after: {
          amount: input.amount,
          method: input.method,
          receiptNumber: receiptNo.number,
          paid: paidAfter,
          remaining: total - paidAfter,
        },
      })
    );
    return { ok: true, payment, replayed: false };
  });
}

export type VoidPaymentResult =
  | { ok: true; payment: PaymentRecord }
  | { ok: false; code: "not_found" | "already_voided" | "invalid_reason" };

/** Marks a payment void (kept, with its receipt shown as VOID) and recalculates the booking totals. */
export async function voidPayment(
  store: BookingStore,
  actor: Actor,
  paymentId: string,
  reason: unknown,
  options: { now?: Date } = {}
): Promise<VoidPaymentResult> {
  const text = typeof reason === "string" ? reason.trim() : "";
  if (text.length < VOID_REASON_MIN || text.length > VOID_REASON_MAX) return { ok: false, code: "invalid_reason" };
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<VoidPaymentResult> => {
    const found = await tx.getPayment(paymentId);
    if (!found) return { ok: false, code: "not_found" };
    const p = found.data;
    if (p.status !== "recorded") return { ok: false, code: "already_voided" };
    const booking = await tx.getBooking(p.bookingId);
    if (!booking) return { ok: false, code: "not_found" };
    const payments = await tx.listPaymentsForBooking(p.bookingId);
    const remainingPayments = payments.filter((x) => x.status === "recorded" && x.paymentId !== paymentId);
    const paid = recordedTotal(remainingPayments);
    const total = booking.data.pricing?.total ?? null;

    const voided = { at: now, by: actorOf(actor), reason: text };
    tx.updatePayment(paymentId, { status: "voided", voided, updatedAt: now }, found.version);
    tx.updateBooking(
      p.bookingId,
      {
        payment: {
          ...booking.data.payment,
          advanceReceived: paid,
          balanceDue: total === null ? null : total - paid,
          paymentCount: remainingPayments.length,
        },
        updatedAt: now,
      },
      booking.version
    );
    notifyInTransaction(tx, { type: "PAYMENT_VOIDED", paymentId, receiptNumber: p.receipt.receiptNumber, amount: p.amount }, booking.data, now);
    tx.createAudit(
      financeAudit("payment_voided", actor, p.bookingId, now, { type: "payment", id: paymentId }, {
        before: { amount: p.amount, receiptNumber: p.receipt.receiptNumber, paid: recordedTotal(payments) },
        after: { paid, remaining: total === null ? null : total - paid },
        reason: text,
      })
    );
    return { ok: true, payment: { ...p, status: "voided", voided, updatedAt: now } };
  });
}

// --------------------------------------------------------------- quotations

export type QuotationResult =
  | { ok: true; quotation: QuotationRecord }
  | {
      ok: false;
      code: "not_found" | "not_allowed" | "pricing_pending" | "not_draft" | "outdated" | "stale";
    };

function policiesOf(config: BusinessConfig): QuotationSnapshot["policies"] {
  const p = config.policies;
  if (!p.active || !(p.cancellationPolicy || p.refundPolicy || p.modificationPolicy)) return null;
  return {
    cancellation: p.cancellationPolicy,
    refund: p.refundPolicy,
    modification: p.modificationPolicy,
    effectiveDate: p.effectiveDate,
  };
}

/** Same stored price as when the draft was made (the booking wasn't repriced since). */
const samePrice = (a: BookingRecord["pricing"], b: QuotationSnapshot["pricing"]) =>
  !!a && a.total === b.total && new Date(a.calculatedAt).getTime() === new Date(b.calculatedAt).getTime();

/**
 * Drafts a quotation from the booking's stored price snapshot (no recalculation).
 * An older unissued draft of the same booking is discarded.
 */
export async function generateQuotation(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  options: { now?: Date; config?: BusinessConfig; business: BusinessSnapshot; expectedUpdatedAt?: string }
): Promise<QuotationResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  return store.runTransaction(async (tx): Promise<QuotationResult> => {
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    if (options.expectedUpdatedAt && new Date(b.updatedAt).toISOString() !== options.expectedUpdatedAt) {
      return { ok: false, code: "stale" };
    }
    if (!financiallyOpen(b, now)) return { ok: false, code: "not_allowed" };
    if (!b.pricing) return { ok: false, code: "pricing_pending" };
    const existing = await tx.listQuotationsForBooking(bookingId);
    const drafts: { id: string; version: unknown }[] = [];
    for (const q of existing.filter((x) => x.status === "draft")) {
      const v = await tx.getQuotation(q.quotationId);
      if (v) drafts.push({ id: q.quotationId, version: v.version });
    }
    const payments = await tx.listPaymentsForBooking(bookingId);
    const paid = recordedTotal(payments);

    const quotation: QuotationRecord = {
      schemaVersion: FINANCE_SCHEMA_VERSION,
      quotationId: `qt_${randomUUID().replace(/-/g, "")}`,
      quotationNumber: null,
      bookingId,
      customerId: b.customerId,
      status: "draft",
      snapshot: {
        business: options.business,
        bookingReference: bookingReference(bookingId),
        customer: partyOf(b),
        event: eventOf(b),
        services: b.services.map((s) => s.label),
        menu: b.menuPreference?.title ?? null,
        package: b.package?.name ?? null,
        pricing: b.pricing,
        requiredAdvance: b.payment?.advanceRequired ?? b.pricing.advanceRequired ?? null,
        paidToDate: paid,
        remaining: b.pricing.total - paid,
        policies: policiesOf(config),
        terms: OFFICIAL_VENUE_TERMS.map((t) => ({ ...t })),
        generatedAt: now,
      },
      createdBy: actorOf(actor),
      issuedBy: null,
      createdAt: now,
      issuedAt: null,
      updatedAt: now,
    };
    for (const d of drafts) tx.updateQuotation(d.id, { status: "discarded", updatedAt: now }, d.version);
    tx.createQuotation(quotation);
    tx.createAudit(
      financeAudit("quotation_generated", actor, bookingId, now, { type: "quotation", id: quotation.quotationId }, {
        after: { total: b.pricing.total, paidToDate: paid, discardedDrafts: drafts.length },
      })
    );
    return { ok: true, quotation };
  });
}

/**
 * Issues a draft: gives it its permanent number (SPQ-YYYY-NNNNNN) and makes it
 * visible to the customer. The previously issued quotation becomes
 * "superseded". The snapshot itself is never modified.
 */
export async function issueQuotation(
  store: BookingStore,
  actor: Actor,
  quotationId: string,
  options: { now?: Date } = {}
): Promise<QuotationResult> {
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<QuotationResult> => {
    const found = await tx.getQuotation(quotationId);
    if (!found) return { ok: false, code: "not_found" };
    const q = found.data;
    if (q.status !== "draft") return { ok: false, code: "not_draft" };
    const booking = await tx.getBooking(q.bookingId);
    if (!booking) return { ok: false, code: "not_found" };
    if (!financiallyOpen(booking.data, now)) return { ok: false, code: "not_allowed" };
    // The booking's price changed after this draft was made: make a new draft.
    if (!samePrice(booking.data.pricing, q.snapshot.pricing)) return { ok: false, code: "outdated" };
    const others = (await tx.listQuotationsForBooking(q.bookingId)).filter((x) => x.status === "issued");
    const previous: { id: string; version: unknown }[] = [];
    for (const o of others) {
      const v = await tx.getQuotation(o.quotationId);
      if (v) previous.push({ id: o.quotationId, version: v.version });
    }
    const number = await nextNumber(tx, "SPQ", now);

    for (const p of previous) tx.updateQuotation(p.id, { status: "superseded", updatedAt: now }, p.version);
    const patch = { status: "issued" as const, quotationNumber: number.number, issuedBy: actorOf(actor), issuedAt: now, updatedAt: now };
    tx.updateQuotation(quotationId, patch, found.version);
    number.commit();
    notifyInTransaction(
      tx,
      { type: "QUOTATION_ISSUED", quotationId, quotationNumber: number.number, total: q.snapshot.pricing.total },
      booking.data,
      now
    );
    tx.createAudit(
      financeAudit("quotation_issued", actor, q.bookingId, now, { type: "quotation", id: quotationId }, {
        after: { quotationNumber: number.number, total: q.snapshot.pricing.total, superseded: previous.length },
      })
    );
    return { ok: true, quotation: { ...q, ...patch } };
  });
}

/** Discards an unissued draft (issued quotations are permanent). */
export async function discardQuotation(
  store: BookingStore,
  actor: Actor,
  quotationId: string,
  options: { now?: Date } = {}
): Promise<QuotationResult> {
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<QuotationResult> => {
    const found = await tx.getQuotation(quotationId);
    if (!found) return { ok: false, code: "not_found" };
    if (found.data.status !== "draft") return { ok: false, code: "not_draft" };
    tx.updateQuotation(quotationId, { status: "discarded", updatedAt: now }, found.version);
    tx.createAudit(
      financeAudit("quotation_discarded", actor, found.data.bookingId, now, { type: "quotation", id: quotationId }, {})
    );
    return { ok: true, quotation: { ...found.data, status: "discarded", updatedAt: now } };
  });
}

/** Whether an issued/draft quotation still matches the booking's current stored price. */
export function quotationIsCurrent(q: QuotationRecord, b: Pick<BookingRecord, "pricing">): boolean {
  return samePrice(b.pricing, q.snapshot.pricing);
}
