// Phase 7 financial scenario against the REAL Firestore adapter on the
// Firestore EMULATOR (never a real project). Refuses to run without
// FIRESTORE_EMULATOR_HOST. Prices are TEST FIXTURES. Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { decideRequest } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment, voidPayment, type PaymentInput } from "../../src/lib/booking/finance.ts";
import { paymentForViewer, quotationForViewer } from "../../src/lib/booking/finance-access.ts";
import { financialSummary } from "../../src/lib/booking/finance-model.ts";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "../booking/engine-scenarios.ts";
import { testConfig } from "../booking/test-config.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "finance-test"));
const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const ADMIN2 = { uid: "admin-2", email: "admin2@example.test" };
const BUSINESS = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000, advance: { mode: "percent", value: 20 } });
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

const pay = (amount: number, over: Partial<PaymentInput> = {}): PaymentInput => ({
  amount, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID(), ...over,
});
const record = (bookingId: string, amount: number, over: Partial<PaymentInput> = {}, actor = ADMIN) =>
  recordPayment(s, actor, bookingId, pay(amount, over), { now: NOW, business: BUSINESS });

describe("firestore emulator: payments, quotations and receipts", () => {
  it("15-step financial scenario", async () => {
    // 1. A priced booking (total 500,000; advance 100,000).
    const created = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW, config: PRICES });
    assert.ok(created.ok);
    const id = created.booking.bookingId;
    // 2–3. Draft a quotation from the stored price, then issue it.
    const draft = await generateQuotation(s, ADMIN, id, { now: NOW, config: PRICES, business: BUSINESS });
    assert.ok(draft.ok);
    const issued = await issueQuotation(s, ADMIN, draft.quotation.quotationId, { now: NOW });
    assert.ok(issued.ok);
    assert.equal(issued.quotation.quotationNumber, "SPQ-2026-000001");
    // 4. Record the advance.
    const advance = await record(id, 100_000);
    assert.ok(advance.ok);
    assert.equal(advance.payment.receipt.receiptNumber, "SPR-2026-000001");
    assert.equal(advance.payment.receipt.quotationNumber, "SPQ-2026-000001");
    // 5. Stored totals (read back from Firestore).
    let b = (await s.getBooking(id))!;
    assert.deepEqual([b.payment.advanceReceived, b.payment.balanceDue, financialSummary(b).status], [100_000, 400_000, "partially_paid"]);
    // 6. The same submission again is not recorded twice.
    const key = randomUUID();
    const p2 = await record(id, 50_000, { requestKey: key });
    const replay = await record(id, 50_000, { requestKey: key });
    assert.ok(p2.ok && replay.ok && replay.replayed);
    assert.equal((await s.listPaymentsForBooking(id)).length, 2);
    // 7. Overpayment is refused.
    assert.deepEqual(await record(id, 350_001), { ok: false, code: "overpayment", remaining: 350_000 });
    // 8. Two admins at once, together exceeding the balance: exactly one commits.
    const race = await Promise.allSettled([record(id, 200_000, {}, ADMIN), record(id, 200_000, {}, ADMIN2)]);
    const committed = race.filter((r) => r.status === "fulfilled" && r.value.ok);
    assert.equal(committed.length, 1, JSON.stringify(race));
    b = (await s.getBooking(id))!;
    assert.equal(b.payment.advanceReceived, 350_000);
    // 9–10. Void the 50,000 payment: kept, totals recalculated.
    assert.ok(p2.ok);
    assert.ok((await voidPayment(s, ADMIN, p2.payment.paymentId, "entered by mistake", { now: NOW })).ok);
    const voided = (await s.getPayment(p2.payment.paymentId))!;
    assert.equal(voided.status, "voided");
    assert.deepEqual(voided.receipt, p2.payment.receipt);
    b = (await s.getBooking(id))!;
    assert.deepEqual([b.payment.advanceReceived, b.payment.balanceDue], [300_000, 200_000]);
    // 11–12. Pay the remainder: Paid.
    const last = await record(id, 200_000);
    assert.ok(last.ok);
    b = (await s.getBooking(id))!;
    assert.deepEqual([b.payment.balanceDue, financialSummary(b).status], [0, "paid"]);
    // 13. Nothing more can be paid.
    assert.deepEqual(await record(id, 1), { ok: false, code: "already_paid" });
    // 14. Receipt numbers are unique and sequential; the issued quotation is unchanged
    //     after a price-relevant change (guests reduced; still above the amount paid).
    const numbers = (await s.listPaymentsForBooking(id)).map((p) => p.receipt.receiptNumber).sort();
    assert.equal(new Set(numbers).size, numbers.length);
    const v = validateChangeRequest({ type: "modification", changes: { guestCount: 450 }, requestKey: randomUUID() }, "2026-10-01", DEFAULT_CONFIG);
    assert.ok(v.ok);
    const req = await submitChangeRequest(s, { uid: "c1" }, id, v.value, { now: NOW });
    assert.ok(req.ok);
    assert.ok((await decideRequest(s, ADMIN, req.request.requestId, "approve", { now: NOW, config: PRICES })).ok);
    const q = (await s.getQuotation(draft.quotation.quotationId))!;
    assert.equal(q.snapshot.pricing.total, 500_000);
    assert.equal((await s.getBooking(id))!.pricing?.total, 550_000);
    // 15. Access: owner yes, other customer no; audit trail complete.
    const owner = { uid: "c1", role: "customer" as const, emailVerified: true };
    const other = { uid: "c2", role: "customer" as const, emailVerified: true };
    assert.ok(await paymentForViewer(s, owner, last.payment.paymentId));
    assert.equal(await paymentForViewer(s, other, last.payment.paymentId), null);
    assert.equal(await quotationForViewer(s, other, q.quotationId), null);
    const actions = (await s.listAuditForBooking(id, 50)).map((a) => a.action);
    for (const a of ["quotation_generated", "quotation_issued", "payment_recorded", "payment_voided"]) assert.ok(actions.includes(a as never), a);
  });
});
