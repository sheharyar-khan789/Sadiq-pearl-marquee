// Event operations end-to-end scenario (Phase 8), shared by the in-memory test
// and the Firestore-emulator test so both run exactly the same steps.
// Vendors and the second hall are TEST FIXTURES (no real vendors exist; a
// vendor clash needs two events in the same slot, i.e. two halls).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { adminSetStatus, decideRequest } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { recordPayment } from "../../src/lib/booking/finance.ts";
import {
  addOpsNote,
  assignVendor,
  createVendor,
  setAssignmentStatus,
  setOpsStatus,
  updateChecklistItem,
  validateVendorInput,
} from "../../src/lib/booking/operations.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import type { BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

export const ADMIN = { uid: "admin-1", email: "admin@example.test" };
export const LABELS = { service: (id: string) => id };
const BUSINESS = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };

/** Test configuration: priced, with a second (fixture) hall. */
export function twoHallConfig(): BusinessConfig {
  const c = testConfig({ hallRent: { "main-hall": 100_000, "test-hall-2": 80_000 }, perGuestRate: 1_000 });
  c.halls = [...c.halls, { ...c.halls[0], id: "test-hall-2", name: "Test Hall 2" }];
  return c;
}

export async function confirmedBooking(s: BookingStore, config: BusinessConfig, uid: string, over: Record<string, unknown>) {
  const r = await createCustomerBookingRequest(s, { uid, email: null }, input(over), { now: NOW, config });
  assert.ok(r.ok, JSON.stringify(r));
  const c = await adminSetStatus(s, ADMIN, r.booking.bookingId, "confirmed", { now: NOW });
  assert.ok(c.ok, JSON.stringify(c));
  return r.booking.bookingId;
}

export async function testVendor(s: BookingStore, name: string) {
  const v = validateVendorInput({ name, category: "photographer", phone: "0300 1112233", whatsapp: "", email: "", notes: "" });
  assert.ok(v.ok, JSON.stringify(v));
  const r = await createVendor(s, ADMIN, v.value, randomUUID(), { now: NOW });
  assert.ok(r.ok);
  return r.vendor.vendorId;
}

export async function operationsScenario(s: BookingStore) {
  const config = twoHallConfig();
  // 1. A confirmed, partly paid event; its operations record is created on the first change.
  const a = await confirmedBooking(s, config, "c1", { date: "2026-10-20", slotId: "day" });
  const paid = await recordPayment(s, ADMIN, a, { amount: 50_000, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() }, { now: NOW, business: BUSINESS });
  assert.ok(paid.ok);
  const bookingBefore = structuredClone((await s.getBooking(a))!);
  const paymentsBefore = structuredClone(await s.listPaymentsForBooking(a));
  assert.equal(await s.getOperations(a), null);

  // 2. Operational status: one step at a time; "in progress" not before the event date.
  assert.ok((await setOpsStatus(s, ADMIN, a, "preparing", { now: NOW, labels: LABELS })).ok);
  assert.equal((await s.getOperations(a))!.status, "preparing");
  assert.deepEqual(await setOpsStatus(s, ADMIN, a, "completed", { now: NOW, labels: LABELS }), { ok: false, code: "invalid_ops_transition" });
  assert.ok((await setOpsStatus(s, ADMIN, a, "ready", { now: NOW, labels: LABELS })).ok);
  assert.deepEqual(await setOpsStatus(s, ADMIN, a, "in_progress", { now: NOW, labels: LABELS }), { ok: false, code: "event_not_started" });

  // 3. Checklist + internal note.
  assert.ok((await updateChecklistItem(s, ADMIN, a, "venue:hall", { status: "completed", note: "Swept and set" }, { now: NOW, labels: LABELS })).ok);
  const hall = (await s.getOperations(a))!.checklist.find((i) => i.id === "venue:hall")!;
  assert.deepEqual([hall.status, hall.completedBy, hall.note], ["completed", ADMIN.email, "Swept and set"]);
  assert.ok((await addOpsNote(s, ADMIN, a, "Stage faces the entrance", { now: NOW, labels: LABELS })).ok);

  // 4. Vendor clash: same vendor, same date + slot, other hall -> refused; other slot -> allowed.
  const vendor = await testVendor(s, "Test Photographer");
  const b = await confirmedBooking(s, config, "c2", { date: "2026-10-20", slotId: "day", hallId: "test-hall-2" });
  const night = await confirmedBooking(s, config, "c3", { date: "2026-10-20", slotId: "night" });
  const assigned = await assignVendor(s, ADMIN, a, { vendorId: vendor, category: "photographer" }, { now: NOW });
  assert.ok(assigned.ok, JSON.stringify(assigned));
  const clash = await assignVendor(s, ADMIN, b, { vendorId: vendor, category: "photographer" }, { now: NOW });
  assert.equal(clash.ok, false);
  assert.equal(!clash.ok && clash.code, "vendor_conflict");
  assert.ok((await assignVendor(s, ADMIN, night, { vendorId: vendor, category: "photographer" }, { now: NOW })).ok, "other slot is fine");

  // 5. Booking change through the normal workflow: B moves to another date. Its
  //    operational data follows (keyed by booking), and the vendor is now free for it.
  const v = validateChangeRequest({ type: "modification", changes: { eventDate: "2026-10-23" }, requestKey: randomUUID() }, "2026-10-01", config);
  assert.ok(v.ok, JSON.stringify(v));
  const req = await submitChangeRequest(s, { uid: "c2" }, b, v.value, { now: NOW });
  assert.ok(req.ok, JSON.stringify(req));
  assert.ok((await decideRequest(s, ADMIN, req.request.requestId, "approve", { now: NOW, config })).ok);
  assert.ok((await assignVendor(s, ADMIN, b, { vendorId: vendor, category: "photographer" }, { now: NOW })).ok, "no clash after the move");

  // 6. Cancellation: operations become read-only history; the vendor is freed for the slot.
  assert.ok((await adminSetStatus(s, ADMIN, a, "cancelled", { now: NOW })).ok);
  assert.deepEqual(await setOpsStatus(s, ADMIN, a, "preparing", { now: NOW, labels: LABELS }), { ok: false, code: "not_operational" });
  assert.ok(await s.getOperations(a), "history kept");
  // B's old slot was released by the move, so a new event can take it; the cancelled A no longer blocks the vendor.
  const c = await confirmedBooking(s, config, "c4", { date: "2026-10-20", slotId: "day", hallId: "test-hall-2" });
  assert.ok((await assignVendor(s, ADMIN, c, { vendorId: vendor, category: "photographer" }, { now: NOW })).ok);

  // 7. Unassign keeps history.
  assert.ok((await setAssignmentStatus(s, ADMIN, assigned.assignment.assignmentId, "cancelled", { now: NOW })).ok);
  assert.equal((await s.listAssignmentsForBooking(a))[0].status, "cancelled");

  // 8. Operations never touched the booking's price or payments (A's status was changed by the booking engine only).
  const after = (await s.getBooking(a))!;
  assert.deepEqual(after.pricing, bookingBefore.pricing);
  assert.deepEqual(after.payment, bookingBefore.payment);
  assert.deepEqual(await s.listPaymentsForBooking(a), paymentsBefore);
  return { a, b, vendor };
}
