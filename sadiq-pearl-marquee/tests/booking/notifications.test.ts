// Notifications & communication (Phase 9): creation on real transitions,
// idempotency, ownership, read state, history immutability, failure handling,
// WhatsApp templates / links / phone safety, manual WhatsApp records, vendor
// contact rules. IN-MEMORY transactional store (not Firestore).
// Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { adminSetStatus, decideRequest } from "../../src/lib/booking/admin.ts";
import { initiateWhatsApp, previewWhatsApp, toNotificationView, validateWhatsAppRequest } from "../../src/lib/booking/communications.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest, createManualBooking } from "../../src/lib/booking/engine.ts";
import { recordPayment, voidPayment } from "../../src/lib/booking/finance.ts";
import { buildNotification, notificationId } from "../../src/lib/booking/notifications.ts";
import { assignVendor, createVendor, validateVendorInput } from "../../src/lib/booking/operations.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { buildWhatsAppMessage, normalizeWhatsAppNumber, whatsAppLink } from "../../src/lib/booking/whatsapp-messages.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { ADMIN, notificationScenario, PRICES } from "./notifications-scenario.ts";

const BUSINESS = { name: "Test Venue", address: "Test", phones: [] };
const CONTACT = { name: "Test Venue", phones: [] };
const types = async (s: MemoryBookingStore, uid: string) => (await s.listNotificationsForCustomer(uid, { before: null, limit: 100 })).map((n) => n.type as string).sort();
const request = async (s: MemoryBookingStore, uid: string, over = {}, config = PRICES) => {
  const r = await createCustomerBookingRequest(s, { uid, email: null }, input(over), { now: NOW, config });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking.bookingId;
};

describe("notifications: full lifecycle (in-memory)", () => {
  it("submitted, confirmed, quotation, payment, change approved, ownership, read state", async () => {
    await notificationScenario(new MemoryBookingStore());
  });
});

describe("booking status notifications", () => {
  it("under review, rejected, cancelled, completed — one each, for the right customer and booking", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, "c1", { date: "2026-10-20" });
    assert.ok((await adminSetStatus(s, ADMIN, a, "under_review", { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, a, "rejected", { now: NOW, reason: "INTERNAL-REASON" })).ok);
    assert.deepEqual(await types(s, "c1"), ["BOOKING_SUBMITTED", "BOOKING_UNDER_REVIEW", "BOOKING_REJECTED"].sort());
    const all = await s.listNotificationsForCustomer("c1", { before: null, limit: 10 });
    assert.ok(all.every((n) => n.bookingId === a && n.customerId === "c1"));
    assert.ok(!JSON.stringify(all).includes("INTERNAL-REASON"), "internal reason never exposed");

    const b = await request(s, "c2", { date: "2026-10-01" });
    assert.ok((await adminSetStatus(s, ADMIN, b, "confirmed", { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, b, "completed", { now: NOW })).ok);
    const c = await request(s, "c3", { date: "2026-10-25" });
    assert.ok((await adminSetStatus(s, ADMIN, c, "confirmed", { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, c, "cancelled", { now: NOW })).ok);
    assert.deepEqual(await types(s, "c2"), ["BOOKING_SUBMITTED", "BOOKING_CONFIRMED", "BOOKING_COMPLETED"].sort());
    assert.deepEqual(await types(s, "c3"), ["BOOKING_SUBMITTED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED"].sort());
    assert.ok(!(await s.listNotificationsForCustomer("c3", { before: null, limit: 10 })).find((n) => n.type === "BOOKING_CANCELLED")!.message.toLowerCase().includes("refund"), "no refund claimed");
  });

  it("an expired hold notifies its customer when another booking takes the slot", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, "c1");
    const later = new Date(NOW.getTime() + 49 * 3_600_000);
    const b = await createCustomerBookingRequest(s, { uid: "c2", email: null }, input(), { now: later, config: PRICES });
    assert.ok(b.ok);
    assert.equal((await s.getBooking(a))!.status, "expired");
    assert.deepEqual(await types(s, "c1"), ["BOOKING_SUBMITTED", "BOOKING_EXPIRED"].sort());
  });

  it("staff bookings: a linked customer is notified; a walk-in (no account) gets nothing", async () => {
    const s = new MemoryBookingStore();
    const linked = await createManualBooking(s, ADMIN, { ...input({ date: "2026-10-20" }), source: "phone", status: "confirmed", customerId: "c1", email: null }, { now: NOW, config: PRICES });
    const walkIn = await createManualBooking(s, ADMIN, { ...input({ date: "2026-10-21" }), source: "walk_in", status: "pending", customerId: null, email: null }, { now: NOW, config: PRICES });
    assert.ok(linked.ok && walkIn.ok);
    assert.deepEqual(await types(s, "c1"), ["BOOKING_CONFIRMED"].sort());
    assert.equal(s.notificationCount(), 1);
  });
});

describe("change and cancellation request notifications", () => {
  it("requested / rejected / approved; refused approvals notify nothing", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1", { date: "2026-10-20" });
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    const change = async (body: object) => {
      const v = validateChangeRequest({ ...body, requestKey: randomUUID() }, "2026-10-01", PRICES);
      assert.ok(v.ok, JSON.stringify(v));
      const r = await submitChangeRequest(s, { uid: "c1" }, id, v.value, { now: NOW });
      assert.ok(r.ok, JSON.stringify(r));
      return r.request.requestId;
    };
    const m1 = await change({ type: "modification", changes: { guestCount: 450 } });
    assert.ok((await decideRequest(s, ADMIN, m1, "reject", { now: NOW, reason: "SECRET", config: PRICES })).ok);
    // A change that would need a refund is refused: no notification is created for it.
    assert.ok((await recordPayment(s, ADMIN, id, { amount: 400_000, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() }, { now: NOW, business: BUSINESS })).ok);
    const m2 = await change({ type: "modification", changes: { guestCount: 100 } });
    const before = s.notificationCount();
    assert.deepEqual(await decideRequest(s, ADMIN, m2, "approve", { now: NOW, config: PRICES }), { ok: false, code: "total_below_paid" });
    assert.equal(s.notificationCount(), before, "refused approval: no notification");
    assert.ok((await decideRequest(s, ADMIN, m2, "reject", { now: NOW, config: PRICES })).ok);
    const c1 = await change({ type: "cancellation" });
    assert.ok((await decideRequest(s, ADMIN, c1, "reject", { now: NOW, config: PRICES })).ok);
    const c2 = await change({ type: "cancellation" });
    assert.ok((await decideRequest(s, ADMIN, c2, "approve", { now: NOW, config: PRICES })).ok);
    assert.deepEqual(await types(s, "c1"), [
      "BOOKING_SUBMITTED", "BOOKING_CONFIRMED",
      "MODIFICATION_REQUESTED", "MODIFICATION_REJECTED",
      "PAYMENT_RECEIVED",
      "MODIFICATION_REQUESTED", "MODIFICATION_REJECTED",
      "CANCELLATION_REQUESTED", "CANCELLATION_REJECTED",
      "CANCELLATION_REQUESTED", "CANCELLATION_APPROVED",
    ].sort());
    const text = JSON.stringify(await s.listNotificationsForCustomer("c1", { before: null, limit: 50 }));
    assert.ok(!text.includes("SECRET"), "decision reasons are internal");
    assert.ok(!/refund (completed|issued|processed)/i.test(text), "no refund claimed");
  });
});

describe("finance notifications", () => {
  it("payment replay adds nothing; void notifies once; no fake amounts", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1");
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    const key = randomUUID();
    const pay = () => recordPayment(s, ADMIN, id, { amount: 25_000, method: "bank_transfer", paidOn: "2026-10-01", reference: "", notes: "", requestKey: key }, { now: NOW, business: BUSINESS });
    const p = await pay();
    const replay = await pay();
    assert.ok(p.ok && replay.ok && replay.replayed);
    assert.ok((await voidPayment(s, ADMIN, p.payment.paymentId, "wrong entry", { now: NOW })).ok);
    assert.deepEqual(await types(s, "c1"), ["BOOKING_SUBMITTED", "BOOKING_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_VOIDED"].sort());
    const voided = (await s.listNotificationsForCustomer("c1", { before: null, limit: 10 })).find((n) => n.type === "PAYMENT_VOIDED")!;
    assert.ok(!voided.message.includes("wrong entry"), "void reason is internal");
    assert.match(voided.message, /Rs 25,000/);
  });
});

describe("idempotency and failure handling", () => {
  it("notification IDs are derived from the event, so the same event can never be stored twice", () => {
    const b = { bookingId: "bk_aaaaaaaaaaaaaaaaaaaaaaaa", customerId: "c1", eventDate: "2026-10-20", slotLabel: "Day", hallName: "Main Hall", eventTypeLabel: "Walima" };
    const x = buildNotification({ type: "BOOKING_CONFIRMED" }, b, NOW)!;
    const y = buildNotification({ type: "BOOKING_CONFIRMED" }, b, new Date(NOW.getTime() + 60_000))!;
    assert.equal(x.notificationId, y.notificationId);
    assert.equal(x.notificationId, notificationId("c1", `booking:${b.bookingId}:confirmed`));
    assert.equal(buildNotification({ type: "BOOKING_CONFIRMED" }, { ...b, customerId: null }, NOW), null, "walk-in: none");
  });

  it("if the notification can't be written, the action reports failure and changes nothing; the retry succeeds once", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1");
    s.failNotificationWrites = 1;
    await assert.rejects(adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW }), /simulated notification write failure/);
    assert.equal((await s.getBooking(id))!.status, "pending", "nothing half-done");
    assert.deepEqual(await types(s, "c1"), ["BOOKING_SUBMITTED"].sort());
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok, "retry");
    assert.deepEqual(await types(s, "c1"), ["BOOKING_SUBMITTED", "BOOKING_CONFIRMED"].sort());
    assert.equal(s.bookingCount(), 1);
  });
});

describe("customer view", () => {
  it("only internal /account links are ever rendered", () => {
    const base = buildNotification({ type: "BOOKING_CONFIRMED" }, { bookingId: "bk_aaaaaaaaaaaaaaaaaaaaaaaa", customerId: "c1", eventDate: "2026-10-20", slotLabel: "Day", hallName: "Main Hall", eventTypeLabel: "Walima" }, NOW)!;
    assert.equal(toNotificationView(base).actionUrl, "/account/bookings/bk_aaaaaaaaaaaaaaaaaaaaaaaa");
    for (const bad of ["https://evil.example", "//evil.example", "/account/../admin", "javascript:alert(1)"]) {
      assert.equal(toNotificationView({ ...base, actionUrl: bad }).actionUrl, null, bad);
    }
  });
});

describe("WhatsApp: numbers, links, templates", () => {
  it("normalises real Pakistani numbers and refuses anything unclear", () => {
    assert.equal(normalizeWhatsAppNumber("0300 1234567"), "923001234567");
    assert.equal(normalizeWhatsAppNumber("+92 300 1234567"), "923001234567");
    assert.equal(normalizeWhatsAppNumber("0092-300-1234567"), "923001234567");
    for (const bad of ["", "abc", "0300", "042 1234567", "javascript:1", "https://wa.me/923001234567", "92 300 12345"]) assert.equal(normalizeWhatsAppNumber(bad), null, bad);
  });

  it("links are always https://wa.me/<digits>?text=<encoded> (no other URL can be produced)", () => {
    const url = whatsAppLink("923001234567", "Rs 1,000 & more?\nNew line");
    assert.equal(url, "https://wa.me/923001234567?text=Rs%201%2C000%20%26%20more%3F%0ANew%20line");
    assert.throws(() => whatsAppLink("evil.example/x", "hi"));
  });

  it("templates use real data only and refuse states that don't exist", async () => {
    const s = new MemoryBookingStore();
    const unpricedId = await request(s, "c1", {}, DEFAULT_CONFIG);
    const unpriced = (await s.getBooking(unpricedId))!;
    assert.deepEqual(buildWhatsAppMessage({ template: "booking_confirmation", booking: unpriced }, CONTACT, "2026-10-01"), { ok: false, code: "booking_not_confirmed" });
    assert.ok((await adminSetStatus(s, ADMIN, unpricedId, "confirmed", { now: NOW })).ok);
    const confirmed = (await s.getBooking(unpricedId))!;
    const m = buildWhatsAppMessage({ template: "booking_confirmation", booking: confirmed }, CONTACT, "2026-10-01");
    assert.ok(m.ok);
    assert.match(m.message, /Price: Pending/);
    assert.ok(!/Rs \d/.test(m.message), "no invented amounts");
    assert.match(m.message, new RegExp(`SP-${unpricedId.slice(-8).toUpperCase()}`));
    assert.deepEqual(buildWhatsAppMessage({ template: "event_reminder", booking: confirmed }, CONTACT, "2027-01-01"), { ok: false, code: "event_not_upcoming" });
  });
});

describe("manual WhatsApp communication records", () => {
  it("recorded as 'initiated' (never delivered), audited without the text, idempotent; nothing else changes", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1", { contactPhone: "0300 7654321" });
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    const before = structuredClone(await s.getBooking(id));
    const v = validateWhatsAppRequest({ bookingId: id, template: "booking_confirmation", requestKey: "k".repeat(20) });
    assert.ok(v.ok);
    const preview = await previewWhatsApp(s, v.value, CONTACT, { now: NOW });
    assert.ok(preview.ok);
    assert.equal(s.communicationCount(), 0, "preview records nothing");
    const key = randomUUID();
    const r = await initiateWhatsApp(s, ADMIN, v.value, key, CONTACT, { now: NOW });
    const again = await initiateWhatsApp(s, ADMIN, v.value, key, CONTACT, { now: NOW });
    assert.ok(r.ok && again.ok && again.replayed);
    assert.equal(s.communicationCount(), 1);
    assert.equal(r.communication.status, "initiated");
    assert.ok(r.url.startsWith("https://wa.me/923007654321?text="));
    const audit = (await s.listAuditForBooking(id, 20)).find((a) => a.action === "whatsapp_initiated")!;
    assert.ok(audit && !JSON.stringify(audit).includes("7654321") && !JSON.stringify(audit).includes("confirmed:"));
    assert.deepEqual(await s.getBooking(id), before, "messaging never changes the booking");
  });

  it("payment / quotation templates need real records of THIS booking; bad phone refused", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1", { contactPhone: "042 1234567" });
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    assert.equal(validateWhatsAppRequest({ bookingId: id, template: "payment_confirmation" }).ok, false, "payment id required");
    assert.equal(validateWhatsAppRequest({ bookingId: id, template: "general", status: "delivered" }).ok, false, "no client-chosen status");
    const missing = await previewWhatsApp(s, { bookingId: id, template: "payment_confirmation", paymentId: "pay_000000000000000000000000", quotationId: null, assignmentId: null }, CONTACT, { now: NOW });
    assert.deepEqual(missing, { ok: false, code: "record_not_found" });
    const general = await previewWhatsApp(s, { bookingId: id, template: "general", paymentId: null, quotationId: null, assignmentId: null }, CONTACT, { now: NOW });
    assert.deepEqual(general, { ok: false, code: "phone_unusable" }, "landline / unclear number is not guessed");
  });

  it("vendor messages use the vendor record's own contact and carry no customer contact or money", async () => {
    const s = new MemoryBookingStore();
    const id = await request(s, "c1", { contactPhone: "0300 7654321" });
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    const vin = validateVendorInput({ name: "Studio X", category: "photographer", phone: "0321 1112223", whatsapp: "0333 9998887" });
    assert.ok(vin.ok);
    const vendor = await createVendor(s, ADMIN, vin.value, randomUUID(), { now: NOW });
    assert.ok(vendor.ok);
    const a = await assignVendor(s, ADMIN, id, { vendorId: vendor.vendor.vendorId, category: "photographer" }, { now: NOW });
    assert.ok(a.ok);
    const r = await initiateWhatsApp(s, ADMIN, { bookingId: id, template: "vendor_event_details", paymentId: null, quotationId: null, assignmentId: a.assignment.assignmentId }, randomUUID(), CONTACT, { now: NOW });
    assert.ok(r.ok);
    assert.ok(r.url.startsWith("https://wa.me/923339998887?"), "vendor WhatsApp from the vendor record");
    assert.equal(r.communication.recipient.kind, "vendor");
    const text = decodeURIComponent(r.url.split("text=")[1]);
    assert.ok(!text.includes("7654321") && !/Rs \d/.test(text), "no customer phone, no money");
    // No customer notification is created for vendor messages.
    assert.ok(!(await s.listNotificationsForCustomer("c1", { before: null, limit: 50 })).some((n) => n.message.includes("Studio X")));
  });
});
