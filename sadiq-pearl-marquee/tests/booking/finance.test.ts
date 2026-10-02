// Payments, quotations and receipts (Phase 7): validation, balances,
// overpayment, idempotency, voiding, numbering, snapshot immutability, access
// control, customer views, PDFs and CONCURRENCY (two admins at once).
// In-memory transactional store with Firestore-like rules (memory-store.ts).
// The prices below are TEST FIXTURES, not the venue's prices.
// Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { adminSetStatus, decideRequest, projectModificationPrice } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { quotationPdf, receiptPdf, pdfSafe } from "../../src/lib/booking/documents-pdf.ts";
import { createCustomerBookingRequest, createManualBooking } from "../../src/lib/booking/engine.ts";
import {
  derivePaymentId,
  discardQuotation,
  generateQuotation,
  issueQuotation,
  priceBooking,
  recordPayment,
  validatePaymentInput,
  voidPayment,
  type PaymentInput,
} from "../../src/lib/booking/finance.ts";
import { paymentForViewer, quotationForViewer } from "../../src/lib/booking/finance-access.ts";
import { documentNumber, financialSummary, type BusinessSnapshot } from "../../src/lib/booking/finance-model.ts";
import { toAdminPaymentView, toCustomerPaymentView, toCustomerQuotationViews } from "../../src/lib/booking/finance-view.ts";
import type { BookingRecord } from "../../src/lib/booking/model.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const ADMIN2 = { uid: "admin-2", email: "admin2@example.test" };
const cust = (n: number) => ({ uid: `cust-${n}`, email: `c${n}@example.test` });
const TODAY = "2026-10-01";
// Test fixture business details (the app uses src/lib/config.ts).
const BUSINESS: BusinessSnapshot = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };

// Hall 100,000 + 1,000 per guest; 400 guests => 500,000. Advance 20% => 100,000.
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000, advance: { mode: "percent", value: 20 } });
const TOTAL = 500_000;

async function pricedBooking(s: MemoryBookingStore, who = cust(1), over = {}, config: BusinessConfig = PRICES) {
  const r = await createCustomerBookingRequest(s, who, input(over), { now: NOW, config });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}
const pay = (amount: number, over: Partial<PaymentInput> = {}): PaymentInput => ({
  amount,
  method: "cash",
  paidOn: TODAY,
  reference: "",
  notes: "",
  requestKey: randomUUID(),
  ...over,
});
const record = (s: MemoryBookingStore, bookingId: string, amount: number, over: Partial<PaymentInput> = {}, actor = ADMIN) =>
  recordPayment(s, actor, bookingId, pay(amount, over), { now: NOW, business: BUSINESS });
const booking = async (s: MemoryBookingStore, id: string) => (await s.getBooking(id))!;

// ------------------------------------------------------------ validation

describe("payment input validation (server-side)", () => {
  const base = { amount: 1000, method: "cash", paidOn: TODAY, reference: "", notes: "", requestKey: "k".repeat(20) };
  const code = (over: object) => {
    const r = validatePaymentInput({ ...base, ...over }, TODAY);
    return r.ok ? "ok" : Object.values(r.errors)[0]!.code;
  };
  it("accepts a valid payment", () => assert.equal(code({}), "ok"));
  for (const [label, over, expected] of [
    ["zero", { amount: 0 }, "invalid_amount"],
    ["negative", { amount: -500 }, "invalid_amount"],
    ["fractional", { amount: 10.5 }, "invalid_amount"],
    ["string amount", { amount: "1000" }, "invalid_amount"],
    ["NaN", { amount: Number.NaN }, "invalid_amount"],
    ["Infinity", { amount: Number.POSITIVE_INFINITY }, "invalid_amount"],
    ["absurdly large", { amount: 10_000_000_000 }, "invalid_amount"],
    ["unknown method", { method: "card_online" }, "invalid_method"],
    ["future date", { paidOn: "2026-10-02" }, "future_date"],
    ["impossible date", { paidOn: "2026-02-30" }, "invalid_date"],
    ["reference too long", { reference: "x".repeat(121) }, "invalid_reference"],
    ["missing request key", { requestKey: undefined }, "invalid_request_key"],
    ["client-supplied balance", { balanceDue: 0 }, "unexpected_field"],
    ["client-supplied status", { status: "recorded" }, "unexpected_field"],
    ["client-supplied receipt number", { receiptNumber: "SPR-2026-000001" }, "unexpected_field"],
    ["client-supplied booking total", { bookingTotal: 1 }, "unexpected_field"],
  ] as const) {
    it(`rejects ${label}`, () => assert.equal(code(over), expected));
  }
  it("rejects a non-object body", () => {
    assert.equal(validatePaymentInput(null, TODAY).ok, false);
    assert.equal(validatePaymentInput([1], TODAY).ok, false);
  });
});

// -------------------------------------------------------------- payments

describe("recording payments", () => {
  it("records a valid payment with a receipt snapshot, updates totals and audits it", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    assert.equal(financialSummary(b).status, "unpaid");
    const key = randomUUID();
    const r = await record(s, b.bookingId, 100_000, { method: "bank_transfer", reference: "TRX-1", notes: "internal", requestKey: key });
    assert.ok(r.ok && !r.replayed, JSON.stringify(r));
    const p = r.payment;
    assert.equal(p.paymentId, derivePaymentId(ADMIN.uid, key));
    assert.equal(p.status, "recorded");
    assert.equal(p.receipt.receiptNumber, "SPR-2026-000001");
    assert.deepEqual(
      [p.receipt.bookingTotal, p.receipt.paidBefore, p.receipt.paidAfter, p.receipt.remainingAfter],
      [TOTAL, 0, 100_000, 400_000]
    );
    assert.deepEqual(p.receipt.business, BUSINESS);
    assert.equal(p.receipt.customer.name, b.customer.name);
    assert.equal(p.customerId, "cust-1");
    assert.deepEqual(p.recordedBy, ADMIN);

    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, 100_000);
    assert.equal(after.payment.balanceDue, 400_000);
    assert.equal(after.payment.paymentCount, 1);
    assert.equal(after.pricing?.total, TOTAL, "the price itself never changes");
    const sum = financialSummary(after);
    assert.deepEqual([sum.status, sum.paid, sum.remaining, sum.requiredAdvance, sum.advanceOutstanding], ["partially_paid", 100_000, 400_000, 100_000, 0]);

    const audit = await s.listAuditForBooking(b.bookingId, 10);
    assert.equal(audit.length, 1);
    assert.equal(audit[0].action, "payment_recorded");
    assert.equal(audit[0].entityType, "payment");
    assert.equal(audit[0].entityId, p.paymentId);
    assert.deepEqual(audit[0].actor, ADMIN);
  });

  it("multiple payments: remaining balance, sequential receipt numbers and Paid status", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const amounts = [50_000, 150_000, 300_000];
    const numbers: string[] = [];
    for (const a of amounts) {
      const r = await record(s, b.bookingId, a);
      assert.ok(r.ok);
      numbers.push(r.payment.receipt.receiptNumber);
    }
    assert.deepEqual(numbers, ["SPR-2026-000001", "SPR-2026-000002", "SPR-2026-000003"]);
    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, TOTAL);
    assert.equal(after.payment.balanceDue, 0);
    assert.equal(financialSummary(after).status, "paid");
    const list = await s.listPaymentsForBooking(b.bookingId);
    assert.deepEqual(list.map((p) => p.receipt.remainingAfter), [450_000, 300_000, 0]);
    assert.deepEqual(await record(s, b.bookingId, 1), { ok: false, code: "already_paid" });
  });

  it("rejects overpayment and writes nothing (no payment, no receipt number, no audit)", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    assert.ok((await record(s, b.bookingId, 450_000)).ok);
    const r = await record(s, b.bookingId, 50_001);
    assert.deepEqual(r, { ok: false, code: "overpayment", remaining: 50_000 });
    assert.equal(s.paymentCount(), 1);
    assert.equal(s.counterValue("receipt-2026"), 1);
    assert.equal((await s.listAuditForBooking(b.bookingId, 10)).length, 1);
    assert.equal((await booking(s, b.bookingId)).payment.advanceReceived, 450_000);
    assert.ok((await record(s, b.bookingId, 50_000)).ok, "the exact remaining amount is accepted");
  });

  it("refuses a booking without a price (no invented amounts)", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s, cust(1), {}, DEFAULT_CONFIG);
    assert.equal(b.pricing, null);
    assert.equal(financialSummary(b).status, "pricing_pending");
    assert.deepEqual(await record(s, b.bookingId, 1000), { ok: false, code: "pricing_pending" });
    assert.equal(s.paymentCount(), 0);
  });

  it("refuses cancelled, rejected and lapsed bookings, and unknown bookings", async () => {
    const s = new MemoryBookingStore();
    const a = await pricedBooking(s, cust(1), { date: "2026-10-20" });
    const c = await pricedBooking(s, cust(2), { date: "2026-10-21" });
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { now: NOW })).ok);
    assert.deepEqual(await record(s, a.bookingId, 1000), { ok: false, code: "booking_inactive" });
    // A pending request whose 48-hour hold has lapsed.
    const later = new Date(NOW.getTime() + 49 * 3_600_000);
    const r = await recordPayment(s, ADMIN, c.bookingId, pay(1000, { paidOn: "2026-10-03" }), { now: later, business: BUSINESS });
    assert.deepEqual(r, { ok: false, code: "booking_inactive" });
    assert.deepEqual(await record(s, "bk_000000000000000000000000", 1000), { ok: false, code: "not_found" });
    assert.equal(s.paymentCount(), 0);
  });

  it("a confirmed or completed booking still accepts payments (balance after the event)", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW })).ok);
    assert.ok((await record(s, b.bookingId, 10_000)).ok);
  });

  it("the same submission twice records ONE payment (idempotent); a reused key for another amount is refused", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const key = randomUUID();
    const first = await record(s, b.bookingId, 20_000, { requestKey: key });
    const again = await record(s, b.bookingId, 20_000, { requestKey: key });
    assert.ok(first.ok && again.ok);
    assert.equal(again.replayed, true);
    assert.equal(again.payment.paymentId, first.payment.paymentId);
    assert.equal(s.paymentCount(), 1);
    assert.equal((await booking(s, b.bookingId)).payment.advanceReceived, 20_000);
    assert.deepEqual(await record(s, b.bookingId, 30_000, { requestKey: key }), { ok: false, code: "duplicate_request" });
    // Another admin using the same key is a different submission.
    assert.ok((await record(s, b.bookingId, 20_000, { requestKey: key }, ADMIN2)).ok);
    assert.equal(s.paymentCount(), 2);
  });

  it("payment IDs are derived from the verified admin + form key, never from the browser", () => {
    assert.match(derivePaymentId("admin-1", "k".repeat(20)), /^pay_[0-9a-f]{24}$/);
    assert.notEqual(derivePaymentId("admin-1", "k".repeat(20)), derivePaymentId("admin-2", "k".repeat(20)));
  });
});

// ------------------------------------------------------------ concurrency

describe("concurrency (two admins at the same time)", () => {
  it("two admins recording overlapping payments cannot overpay: exactly one succeeds", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const [x, y] = await Promise.all([record(s, b.bookingId, 300_000, {}, ADMIN), record(s, b.bookingId, 300_000, {}, ADMIN2)]);
    const results = [x, y];
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
    assert.deepEqual(results.find((r) => !r.ok), { ok: false, code: "overpayment", remaining: 200_000 });
    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, 300_000);
    assert.equal(after.payment.balanceDue, 200_000);
    assert.equal(s.paymentCount(), 1);
    assert.equal(s.counterValue("receipt-2026"), 1);
    assert.ok(s.retries > 0, "the losing transaction was retried and re-validated");
  });

  it("ten concurrent payments: every committed one is counted, with unique, gap-free receipt numbers", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) => record(s, b.bookingId, 50_000, {}, i % 2 ? ADMIN : ADMIN2))
    );
    // Heavy contention may exhaust the 5 retry attempts (Firestore behaves the same:
    // the request fails with "aborted" and NOTHING is written). None may overpay.
    const ok = settled.filter((r) => r.status === "fulfilled" && r.value.ok);
    for (const r of settled) {
      if (r.status === "rejected") assert.equal((r.reason as { code?: string }).code, "aborted");
      else assert.ok(r.value.ok, JSON.stringify(r.value));
    }
    assert.ok(ok.length >= 1);
    assert.equal(s.paymentCount(), ok.length, "an aborted attempt leaves no payment behind");
    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, ok.length * 50_000);
    const numbers = (await s.listPaymentsForBooking(b.bookingId)).map((p) => p.receipt.receiptNumber).sort();
    assert.deepEqual(numbers, Array.from({ length: ok.length }, (_, i) => documentNumber("SPR", "2026", i + 1)));
  });

  it("receipt numbers stay unique when payments for DIFFERENT bookings race", async () => {
    const s = new MemoryBookingStore();
    const a = await pricedBooking(s, cust(1), { date: "2026-10-20" });
    const b = await pricedBooking(s, cust(2), { date: "2026-10-21" });
    const [x, y] = await Promise.all([record(s, a.bookingId, 1000, {}, ADMIN), record(s, b.bookingId, 1000, {}, ADMIN2)]);
    assert.ok(x.ok && y.ok);
    assert.deepEqual([x.payment.receipt.receiptNumber, y.payment.receipt.receiptNumber].sort(), ["SPR-2026-000001", "SPR-2026-000002"]);
  });

  it("a payment racing a void keeps the totals equal to the sum of recorded payments", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const first = await record(s, b.bookingId, 100_000);
    assert.ok(first.ok);
    await Promise.all([voidPayment(s, ADMIN2, first.payment.paymentId, "entered twice", { now: NOW }), record(s, b.bookingId, 200_000)]);
    const list = await s.listPaymentsForBooking(b.bookingId);
    const sum = list.filter((p) => p.status === "recorded").reduce((t, p) => t + p.amount, 0);
    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, sum);
    assert.equal(after.payment.balanceDue, TOTAL - sum);
  });
});

// ----------------------------------------------------------------- voiding

describe("voiding payments (correction, never deletion)", () => {
  it("void keeps the record and receipt, recalculates totals and audits the reason", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p1 = await record(s, b.bookingId, 100_000);
    const p2 = await record(s, b.bookingId, 50_000);
    assert.ok(p1.ok && p2.ok);
    const v = await voidPayment(s, ADMIN2, p1.payment.paymentId, "Wrong amount entered", { now: NOW });
    assert.ok(v.ok);
    const stored = (await s.getPayment(p1.payment.paymentId))!;
    assert.equal(stored.status, "voided");
    assert.equal(stored.voided?.reason, "Wrong amount entered");
    assert.deepEqual(stored.voided?.by, ADMIN2);
    assert.deepEqual(stored.receipt, p1.payment.receipt, "the receipt snapshot is unchanged");
    assert.equal(stored.amount, 100_000);
    assert.equal(s.paymentCount(), 2, "nothing deleted");
    const after = await booking(s, b.bookingId);
    assert.equal(after.payment.advanceReceived, 50_000);
    assert.equal(after.payment.balanceDue, 450_000);
    assert.equal(after.payment.paymentCount, 1);
    const audit = (await s.listAuditForBooking(b.bookingId, 10)).find((a) => a.action === "payment_voided");
    assert.equal(audit?.reason, "Wrong amount entered");
    assert.equal(audit?.entityId, p1.payment.paymentId);
  });

  it("refuses a second void, a missing reason and unknown payments", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p = await record(s, b.bookingId, 1000);
    assert.ok(p.ok);
    assert.deepEqual(await voidPayment(s, ADMIN, p.payment.paymentId, "  ", { now: NOW }), { ok: false, code: "invalid_reason" });
    assert.deepEqual(await voidPayment(s, ADMIN, p.payment.paymentId, undefined, { now: NOW }), { ok: false, code: "invalid_reason" });
    assert.ok((await voidPayment(s, ADMIN, p.payment.paymentId, "duplicate", { now: NOW })).ok);
    assert.deepEqual(await voidPayment(s, ADMIN, p.payment.paymentId, "again", { now: NOW }), { ok: false, code: "already_voided" });
    assert.deepEqual(await voidPayment(s, ADMIN, "pay_000000000000000000000000", "x y z", { now: NOW }), { ok: false, code: "not_found" });
  });

  it("after a void the freed balance can be paid again, and a new receipt number is used", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p = await record(s, b.bookingId, TOTAL);
    assert.ok(p.ok);
    assert.ok((await voidPayment(s, ADMIN, p.payment.paymentId, "cheque bounced", { now: NOW })).ok);
    const again = await record(s, b.bookingId, TOTAL);
    assert.ok(again.ok);
    assert.equal(again.payment.receipt.receiptNumber, "SPR-2026-000002");
  });
});

// ---------------------------------------------------------------- pricing

describe("pricing a booking that has no price yet", () => {
  it("calculates it once with the one pricing engine and audits it; never recalculates an existing price", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s, cust(1), {}, DEFAULT_CONFIG);
    const missing = await priceBooking(s, ADMIN, b.bookingId, { now: NOW, config: DEFAULT_CONFIG });
    assert.equal(missing.ok, false);
    assert.equal(!missing.ok && missing.code, "pricing_incomplete");
    assert.ok(!missing.ok && "missing" in missing && missing.missing.length > 0);

    const r = await priceBooking(s, ADMIN, b.bookingId, { now: NOW, config: PRICES });
    assert.ok(r.ok);
    const after = await booking(s, b.bookingId);
    assert.equal(after.pricing?.total, TOTAL);
    assert.equal(after.payment.advanceRequired, 100_000);
    assert.equal(after.payment.balanceDue, TOTAL);
    const again = await priceBooking(s, ADMIN, b.bookingId, { now: NOW, config: testConfig({ hallRent: { "main-hall": 1 }, perGuestRate: 1 }) });
    assert.deepEqual(again, { ok: false, code: "already_priced" });
    assert.equal((await booking(s, b.bookingId)).pricing?.total, TOTAL);
    assert.ok((await s.listAuditForBooking(b.bookingId, 10)).some((a) => a.action === "booking_priced"));
  });

  it("stale form: refuses when the booking changed since the page was loaded", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s, cust(1), {}, DEFAULT_CONFIG);
    const r = await priceBooking(s, ADMIN, b.bookingId, { now: NOW, config: PRICES, expectedUpdatedAt: "2020-01-01T00:00:00.000Z" });
    assert.deepEqual(r, { ok: false, code: "stale" });
  });
});

// ------------------------------------------------------------- quotations

async function modification(s: MemoryBookingStore, who: { uid: string }, bookingId: string, changes: object) {
  const v = validateChangeRequest({ type: "modification", changes, requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
  assert.ok(v.ok, JSON.stringify(v));
  const r = await submitChangeRequest(s, who, bookingId, v.value, { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  return r.request;
}

describe("quotations", () => {
  it("a draft is a copy of the booking's STORED price snapshot (no second pricing engine)", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    await record(s, b.bookingId, 100_000);
    const policies = { ...DEFAULT_CONFIG.policies, cancellationPolicy: "Test cancellation text", active: true };
    // Even with DIFFERENT current prices, the quotation uses the booking's stored price.
    const other = testConfig({ hallRent: { "main-hall": 1 }, perGuestRate: 1 }, { policies });
    const r = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, config: other, business: BUSINESS });
    assert.ok(r.ok);
    const q = r.quotation;
    assert.equal(q.status, "draft");
    assert.equal(q.quotationNumber, null);
    assert.deepEqual(q.snapshot.pricing, (await booking(s, b.bookingId)).pricing);
    assert.equal(q.snapshot.pricing.total, TOTAL);
    assert.deepEqual([q.snapshot.requiredAdvance, q.snapshot.paidToDate, q.snapshot.remaining], [100_000, 100_000, 400_000]);
    assert.equal(q.snapshot.policies?.cancellation, "Test cancellation text");
    assert.equal(q.snapshot.bookingReference, `SP-${b.bookingId.slice(-8).toUpperCase()}`);
    assert.deepEqual(q.snapshot.business, BUSINESS);
    const noPolicy = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, config: PRICES, business: BUSINESS });
    assert.ok(noPolicy.ok);
    assert.equal(noPolicy.quotation.snapshot.policies, null, "inactive policies are not printed");
  });

  it("refuses bookings without a price or that are no longer active", async () => {
    const s = new MemoryBookingStore();
    const unpriced = await pricedBooking(s, cust(1), { date: "2026-10-20" }, DEFAULT_CONFIG);
    assert.deepEqual(await generateQuotation(s, ADMIN, unpriced.bookingId, { now: NOW, business: BUSINESS }), { ok: false, code: "pricing_pending" });
    const b = await pricedBooking(s, cust(2), { date: "2026-10-21" });
    assert.ok((await adminSetStatus(s, ADMIN, b.bookingId, "rejected", { now: NOW })).ok);
    assert.deepEqual(await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS }), { ok: false, code: "not_allowed" });
    assert.equal(s.quotationCount(), 0);
  });

  it("numbers are assigned at issue, sequentially; a new draft discards the old one; issuing supersedes", async () => {
    const s = new MemoryBookingStore();
    const a = await pricedBooking(s, cust(1), { date: "2026-10-20" });
    const b = await pricedBooking(s, cust(2), { date: "2026-10-21" });
    const d1 = await generateQuotation(s, ADMIN, a.bookingId, { now: NOW, business: BUSINESS });
    const d2 = await generateQuotation(s, ADMIN, a.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d1.ok && d2.ok);
    assert.equal((await s.getQuotation(d1.quotation.quotationId))?.status, "discarded");
    assert.deepEqual(await issueQuotation(s, ADMIN, d1.quotation.quotationId, { now: NOW }), { ok: false, code: "not_draft" });
    const i1 = await issueQuotation(s, ADMIN, d2.quotation.quotationId, { now: NOW });
    assert.ok(i1.ok);
    assert.equal(i1.quotation.quotationNumber, "SPQ-2026-000001");
    const qb = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(qb.ok);
    const ib = await issueQuotation(s, ADMIN, qb.quotation.quotationId, { now: NOW });
    assert.ok(ib.ok);
    assert.equal(ib.quotation.quotationNumber, "SPQ-2026-000002");
    // Re-issue for booking A: the earlier issued quotation is superseded, its number kept.
    const d3 = await generateQuotation(s, ADMIN, a.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d3.ok);
    const i3 = await issueQuotation(s, ADMIN, d3.quotation.quotationId, { now: NOW });
    assert.ok(i3.ok);
    assert.equal(i3.quotation.quotationNumber, "SPQ-2026-000003");
    const old = (await s.getQuotation(d2.quotation.quotationId))!;
    assert.equal(old.status, "superseded");
    assert.equal(old.quotationNumber, "SPQ-2026-000001");
    assert.deepEqual(await discardQuotation(s, ADMIN, i3.quotation.quotationId, { now: NOW }), { ok: false, code: "not_draft" });
    const actions = (await s.listAuditForBooking(a.bookingId, 20)).map((x) => x.action);
    assert.ok(actions.includes("quotation_generated") && actions.includes("quotation_issued"));
    // The receipt of a later payment names the current quotation.
    const p = await record(s, a.bookingId, 1000);
    assert.ok(p.ok);
    assert.equal(p.payment.receipt.quotationNumber, "SPQ-2026-000003");
  });

  it("issued quotations are immutable: later price changes and booking changes never alter them", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const d = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d.ok);
    const issued = await issueQuotation(s, ADMIN, d.quotation.quotationId, { now: NOW });
    assert.ok(issued.ok);
    const before = structuredClone((await s.getQuotation(d.quotation.quotationId))!);

    // Prices go up, and the customer's change is approved with the NEW prices.
    const newPrices = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 2_000, advance: { mode: "percent", value: 20 } });
    const req = await modification(s, cust(1), b.bookingId, { guestCount: 450 });
    const decided = await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW, config: newPrices });
    assert.ok(decided.ok, JSON.stringify(decided));
    assert.equal((await booking(s, b.bookingId)).pricing?.total, 1_000_000);

    const after = (await s.getQuotation(d.quotation.quotationId))!;
    assert.deepEqual(after.snapshot, before.snapshot, "snapshot unchanged");
    assert.equal(after.quotationNumber, "SPQ-2026-000001");
    assert.equal(after.snapshot.pricing.total, TOTAL);
    const view = toCustomerQuotationViews([after], await booking(s, b.bookingId))[0];
    assert.equal(view.matchesBooking, false, "shown as out of date, not rewritten");

    // A draft made before the change can't be issued any more.
    const s2 = new MemoryBookingStore();
    const b2 = await pricedBooking(s2);
    const draft = await generateQuotation(s2, ADMIN, b2.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(draft.ok);
    const req2 = await modification(s2, cust(1), b2.bookingId, { guestCount: 450 });
    assert.ok((await decideRequest(s2, ADMIN, req2.requestId, "approve", { now: NOW, config: newPrices })).ok);
    assert.deepEqual(await issueQuotation(s2, ADMIN, draft.quotation.quotationId, { now: NOW }), { ok: false, code: "outdated" });
  });

  it("a change that would lower the price below the amount already paid is refused (nothing changes)", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    assert.ok((await record(s, b.bookingId, 400_000)).ok);
    const req = await modification(s, cust(1), b.bookingId, { guestCount: 100 }); // would be 200,000
    const r = await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW, config: PRICES });
    assert.deepEqual(r, { ok: false, code: "total_below_paid" });
    const after = await booking(s, b.bookingId);
    assert.equal(after.guestCount, 400);
    assert.equal(after.pricing?.total, TOTAL);
    assert.equal((await s.getRequest(req.requestId))?.status, "open");
    // Phase 8: payments and receipts are untouched by the refused approval.
    const payments = await s.listPaymentsForBooking(b.bookingId);
    assert.deepEqual(payments.map((p) => [p.amount, p.status, p.receipt.paidAfter]), [[400_000, "recorded", 400_000]]);
  });

  it("Phase 8: the 'refund / financial adjustment required' projection flags such a request before approval", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    assert.ok((await record(s, b.bookingId, 400_000)).ok);
    const current = await booking(s, b.bookingId);
    const lower = projectModificationPrice(current, { guestCount: 100 }, PRICES, NOW);
    assert.deepEqual(lower, { repriced: true, total: 200_000 });
    assert.ok(lower.repriced && lower.total !== null && lower.total < current.payment.advanceReceived, "flagged");
    const higher = projectModificationPrice(current, { guestCount: 450 }, PRICES, NOW);
    assert.deepEqual(higher, { repriced: true, total: 550_000 });
    assert.deepEqual(projectModificationPrice(current, { notes: "x" } as never, PRICES, NOW), { repriced: false });
    // The projection writes nothing.
    assert.deepEqual(await booking(s, b.bookingId), current);
  });
});

// ------------------------------------------------- access & customer views

describe("document access (tenant isolation) and customer views", () => {
  const admin = { uid: "admin-1", role: "super_admin" as const, emailVerified: true };
  const owner = { uid: "cust-1", role: "customer" as const, emailVerified: true };
  const other = { uid: "cust-2", role: "customer" as const, emailVerified: true };
  const unverifiedAdmin = { uid: "admin-x", role: "super_admin" as const, emailVerified: false };

  it("customers get only their own receipts and issued quotations; drafts stay internal", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p = await record(s, b.bookingId, 1000);
    assert.ok(p.ok);
    const d = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d.ok);
    const id = d.quotation.quotationId;

    assert.ok(await paymentForViewer(s, admin, p.payment.paymentId));
    assert.ok(await paymentForViewer(s, owner, p.payment.paymentId));
    assert.equal(await paymentForViewer(s, other, p.payment.paymentId), null, "another customer's receipt");
    assert.equal(await paymentForViewer(s, unverifiedAdmin, p.payment.paymentId), null);
    assert.equal(await paymentForViewer(s, owner, "../../etc/passwd"), null);

    assert.ok(await quotationForViewer(s, admin, id));
    assert.equal(await quotationForViewer(s, owner, id), null, "a draft is not visible to the customer");
    assert.ok((await issueQuotation(s, ADMIN, id, { now: NOW })).ok);
    assert.ok(await quotationForViewer(s, owner, id));
    assert.equal(await quotationForViewer(s, other, id), null, "another customer's quotation");
  });

  it("an offline (walk-in) booking's documents are admin-only", async () => {
    const s = new MemoryBookingStore();
    const m = await createManualBooking(
      s,
      ADMIN,
      { ...input(), source: "walk_in", status: "confirmed", customerId: null, email: null },
      { now: NOW, config: PRICES }
    );
    assert.ok(m.ok, JSON.stringify(m));
    const p = await record(s, m.booking.bookingId, 1000);
    assert.ok(p.ok);
    assert.equal(p.payment.customerId, null);
    assert.equal(await paymentForViewer(s, owner, p.payment.paymentId), null);
    assert.ok(await paymentForViewer(s, admin, p.payment.paymentId));
  });

  it("customer payment views never include internal notes, staff identities or void reasons", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p = await record(s, b.bookingId, 1000, { notes: "INTERNAL NOTE", reference: "REF-9" });
    assert.ok(p.ok);
    assert.ok((await voidPayment(s, ADMIN, p.payment.paymentId, "SECRET REASON", { now: NOW })).ok);
    const stored = (await s.getPayment(p.payment.paymentId))!;
    const view = toCustomerPaymentView(stored);
    const text = JSON.stringify(view);
    for (const leak of ["INTERNAL NOTE", "SECRET REASON", "admin@example.test", "admin-1"]) assert.ok(!text.includes(leak), leak);
    assert.equal(view.status, "voided");
    const adminView = toAdminPaymentView(stored);
    assert.equal(adminView.notes, "INTERNAL NOTE");
    assert.equal(adminView.voidReason, "SECRET REASON");
  });

  it("customer quotation list shows only issued/superseded, newest first", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const d1 = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d1.ok);
    assert.ok((await issueQuotation(s, ADMIN, d1.quotation.quotationId, { now: NOW })).ok);
    const later = new Date(NOW.getTime() + 60_000);
    const d2 = await generateQuotation(s, ADMIN, b.bookingId, { now: later, business: BUSINESS });
    assert.ok(d2.ok);
    const list = await s.listQuotationsForBooking(b.bookingId);
    const views = toCustomerQuotationViews(list, await booking(s, b.bookingId));
    assert.deepEqual(views.map((v) => v.status), ["issued"], "the new draft is hidden");
  });
});

// ---------------------------------------------------------------- receipts & PDFs

describe("receipts and PDFs (from stored snapshots only)", () => {
  it("receipt and quotation PDFs are valid PDFs built from the stored documents", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s, cust(1), { contactName: "علی Khan" });
    const p = await record(s, b.bookingId, 100_000, { reference: "CHQ-77", method: "cheque" });
    assert.ok(p.ok);
    const d = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(d.ok);
    assert.ok((await issueQuotation(s, ADMIN, d.quotation.quotationId, { now: NOW })).ok);

    for (const bytes of [
      await receiptPdf((await s.getPayment(p.payment.paymentId))!, null),
      await quotationPdf((await s.getQuotation(d.quotation.quotationId))!, null),
    ]) {
      assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
      const doc = await PDFDocument.load(bytes);
      assert.ok(doc.getPageCount() >= 1);
      assert.match(doc.getTitle() ?? "", /SPR-2026-000001|SPQ-2026-000001/);
    }
    // A voided receipt still renders (marked VOID), from the same snapshot.
    assert.ok((await voidPayment(s, ADMIN, p.payment.paymentId, "bounced", { now: NOW })).ok);
    const voided = await receiptPdf((await s.getPayment(p.payment.paymentId))!, null);
    assert.ok((await PDFDocument.load(voided)).getPageCount() >= 1);
    // A draft quotation renders as DRAFT.
    const draft = await generateQuotation(s, ADMIN, b.bookingId, { now: NOW, business: BUSINESS });
    assert.ok(draft.ok);
    assert.match((await PDFDocument.load(await quotationPdf(draft.quotation, null))).getTitle() ?? "", /DRAFT/);
  });

  it("the receipt snapshot does not change when the booking or payments change later", async () => {
    const s = new MemoryBookingStore();
    const b = await pricedBooking(s);
    const p1 = await record(s, b.bookingId, 100_000);
    assert.ok(p1.ok);
    const snap = structuredClone(p1.payment.receipt);
    await record(s, b.bookingId, 200_000);
    const req = await modification(s, cust(1), b.bookingId, { guestCount: 450 });
    assert.ok((await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW, config: PRICES })).ok);
    assert.deepEqual((await s.getPayment(p1.payment.paymentId))!.receipt, snap);
  });

  it("text outside the PDF font's character set is replaced, never crashes", () => {
    assert.equal(pdfSafe("Ali – Khan"), "Ali – Khan");
    assert.equal(pdfSafe("علی"), "???");
    assert.equal(pdfSafe("a\nb"), "a b");
  });
});

// Type-only guard: BookingRecord payment fields used by the finance code exist.
const _typeCheck: Pick<BookingRecord["payment"], "advanceReceived" | "balanceDue" | "paymentCount"> = { advanceReceived: 0, balanceDue: null };
void _typeCheck;
