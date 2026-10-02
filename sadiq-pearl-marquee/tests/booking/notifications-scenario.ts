// Customer notification lifecycle (Phase 9), shared by the in-memory test and
// the Firestore-emulator test. Prices are TEST FIXTURES.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { adminSetStatus, decideRequest } from "../../src/lib/booking/admin.ts";
import { markAllNotificationsRead, markNotificationRead } from "../../src/lib/booking/communications.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment } from "../../src/lib/booking/finance.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

export const ADMIN = { uid: "admin-1", email: "admin@example.test" };
export const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000 });
const BUSINESS = { name: "Test Venue", address: "Test address", phones: [] };

export async function notificationScenario(s: BookingStore) {
  const c1 = { uid: "cust-1", email: null };
  const c2 = { uid: "cust-2", email: null };
  const types = async (uid: string) => (await s.listNotificationsForCustomer(uid, { before: null, limit: 100 })).map((n) => n.type as string).sort();

  // Submitted (and a retried submission does not duplicate it).
  const req = input({ date: "2026-10-20" });
  const created = await createCustomerBookingRequest(s, c1, req, { now: NOW, config: PRICES });
  const again = await createCustomerBookingRequest(s, c1, req, { now: NOW, config: PRICES });
  assert.ok(created.ok && again.ok && again.duplicate);
  const id = created.booking.bookingId;
  assert.deepEqual(await types("cust-1"), ["BOOKING_SUBMITTED"].sort());

  // Confirmed once; a repeated confirm is refused and adds nothing.
  assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
  assert.equal((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok, false);
  assert.deepEqual(await types("cust-1"), ["BOOKING_SUBMITTED", "BOOKING_CONFIRMED"].sort());
  const confirmedText = (await s.listNotificationsForCustomer("cust-1", { before: null, limit: 10 })).find((n) => n.type === "BOOKING_CONFIRMED")!.message;

  // Finance: quotation issued, payment received (with the real receipt number).
  const q = await generateQuotation(s, ADMIN, id, { now: NOW, business: BUSINESS });
  assert.ok(q.ok);
  const issued = await issueQuotation(s, ADMIN, q.quotation.quotationId, { now: NOW });
  assert.ok(issued.ok);
  const p = await recordPayment(s, ADMIN, id, { amount: 100_000, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() }, { now: NOW, business: BUSINESS });
  assert.ok(p.ok);
  const list = await s.listNotificationsForCustomer("cust-1", { before: null, limit: 100 });
  const payN = list.find((n) => n.type === "PAYMENT_RECEIVED")!;
  assert.match(payN.message, new RegExp(p.payment.receipt.receiptNumber));
  assert.match(payN.message, /Rs 100,000/);
  assert.match(list.find((n) => n.type === "QUOTATION_ISSUED")!.message, new RegExp(issued.quotation.quotationNumber!));

  // Modification approved: a NEW notification; the old confirmation text is unchanged.
  const v = validateChangeRequest({ type: "modification", changes: { eventDate: "2026-10-22" }, requestKey: randomUUID() }, "2026-10-01", PRICES);
  assert.ok(v.ok);
  const r = await submitChangeRequest(s, c1, id, v.value, { now: NOW });
  assert.ok(r.ok);
  assert.ok((await decideRequest(s, ADMIN, r.request.requestId, "approve", { now: NOW, config: PRICES })).ok);
  const after = await s.listNotificationsForCustomer("cust-1", { before: null, limit: 100 });
  assert.equal(after.find((n) => n.type === "BOOKING_CONFIRMED")!.message, confirmedText, "history not rewritten");
  assert.match(after.find((n) => n.type === "MODIFICATION_APPROVED")!.message, /22 October 2026[\s\S]*previously Tuesday, 20 October 2026/);

  // Ownership and read state.
  const unread = await s.countUnreadNotifications("cust-1");
  assert.equal(unread, after.length);
  const first = after[0];
  assert.deepEqual(await markNotificationRead(s, "cust-2", first.notificationId, { now: NOW }), { ok: false, code: "not_found" });
  assert.deepEqual(await markNotificationRead(s, "cust-1", first.notificationId, { now: NOW }), { ok: true, changed: true });
  assert.deepEqual(await markNotificationRead(s, "cust-1", first.notificationId, { now: NOW }), { ok: true, changed: false });
  assert.equal(await s.countUnreadNotifications("cust-1"), unread - 1);
  assert.equal((await markAllNotificationsRead(s, "cust-2", { now: NOW })).count, 0, "another customer's mark-all touches nothing");
  assert.equal(await s.countUnreadNotifications("cust-1"), unread - 1);
  assert.equal((await markAllNotificationsRead(s, "cust-1", { now: NOW })).count, unread - 1);
  assert.equal(await s.countUnreadNotifications("cust-1"), 0);
  assert.deepEqual(await types("cust-2"), [].sort());
  void c2;
  return { id };
}
