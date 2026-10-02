// Customer portal (Phase 4): ownership, change requests, read model, profile
// validation. In-memory transactional store; run with: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { validateProfileUpdate } from "../../src/lib/account/profile.ts";
import {
  getOwnBooking,
  listOwnBookings,
  listOwnRequests,
  submitChangeRequest,
  validateChangeRequest,
  type ChangeRequestInput,
} from "../../src/lib/booking/customer.ts";
import { changeBookingStatus, createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import type { BookingRecord } from "../../src/lib/booking/model.ts";
import {
  canRequestChanges,
  matchesFilter,
  nextUpcoming,
  sortForCustomer,
  summaryCounts,
  toCustomerView,
} from "../../src/lib/booking/portal.ts";
import type { BookingStatus } from "../../src/lib/booking/status.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";

const A = { uid: "customer-a", email: "a@example.test" };
const B = { uid: "customer-b", email: "b@example.test" };
const TODAY = "2026-10-01";
const HOUR = 3_600_000;

async function book(store: MemoryBookingStore, who: { uid: string; email: string }, over = {}, status?: BookingStatus) {
  const r = await createCustomerBookingRequest(store, who, input(over), { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  if (status === "confirmed" || status === "completed" || status === "cancelled") {
    assert.ok((await changeBookingStatus(store, r.booking.bookingId, "confirmed", { now: NOW })).ok);
  }
  if (status === "completed" || status === "cancelled") {
    assert.ok((await changeBookingStatus(store, r.booking.bookingId, status, { now: NOW })).ok);
  }
  return (await store.getBooking(r.booking.bookingId))!;
}

const modification = (changes: Record<string, unknown>): ChangeRequestInput => {
  const v = validateChangeRequest({ type: "modification", changes, requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
  assert.ok(v.ok, JSON.stringify(v));
  return v.value;
};
const cancellation = (reason = ""): ChangeRequestInput => {
  const v = validateChangeRequest({ type: "cancellation", reason, requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
  assert.ok(v.ok, JSON.stringify(v));
  return v.value;
};

describe("booking access is scoped to the signed-in customer", () => {
  it("A can read A's booking; B gets nothing for A's booking ID", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A);
    assert.equal((await getOwnBooking(s, A.uid, a.bookingId))?.bookingId, a.bookingId);
    assert.equal(await getOwnBooking(s, B.uid, a.bookingId), null);
  });

  it("malformed or unknown booking IDs return nothing", async () => {
    const s = new MemoryBookingStore();
    for (const id of ["", "../users/x", "bk_ZZZ", "bk_" + "0".repeat(24), "customer-b-booking"]) {
      assert.equal(await getOwnBooking(s, A.uid, id), null, id);
    }
  });

  it("the booking list contains only the customer's own bookings", async () => {
    const s = new MemoryBookingStore();
    await book(s, A, { date: "2026-10-20" });
    await book(s, A, { date: "2026-10-21" });
    await book(s, B, { date: "2026-10-22" });
    const mine = await listOwnBookings(s, A.uid);
    assert.equal(mine.length, 2);
    assert.ok(mine.every((b) => b.customerId === A.uid));
    assert.deepEqual(await listOwnBookings(s, ""), []);
  });
});

describe("modification requests", () => {
  it("A can request a change to A's booking; the booking and slot lock are untouched", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, {}, "confirmed");
    const lockBefore = s.lockFor(a.slotKey);
    const r = await submitChangeRequest(s, A, a.bookingId, modification({ guestCount: 650, notes: "More family" }), { now: NOW });
    assert.ok(r.ok && !r.duplicate);
    assert.equal(r.request.customerId, A.uid);
    assert.equal(r.request.status, "open");
    assert.deepEqual(r.request.changes, { guestCount: 650, notes: "More family" });
    const after = (await s.getBooking(a.bookingId))!;
    assert.equal(after.guestCount, a.guestCount);
    assert.equal(after.status, "confirmed");
    assert.deepEqual(s.lockFor(a.slotKey), lockBefore);
  });

  it("B cannot file a request for A's booking (not found)", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A);
    assert.deepEqual(await submitChangeRequest(s, B, a.bookingId, cancellation(), { now: NOW }), { ok: false, code: "not_found" });
    assert.equal(s.requestCount(), 0);
  });

  it("a new date/slot is checked and recorded, never reserved; the old slot stays with the booking", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, { date: "2026-10-20", slotId: "day" }, "confirmed");
    await book(s, B, { date: "2026-10-25", slotId: "night" }, "confirmed");
    const taken = await submitChangeRequest(s, A, a.bookingId, modification({ eventDate: "2026-10-25", slotId: "night" }), { now: NOW });
    assert.ok(taken.ok);
    assert.deepEqual(taken.request.requestedSlot, { slotKey: "2026-10-25__main-hall__night", stateAtRequest: "booked" });
    const locks = s.lockCount();
    const s2 = new MemoryBookingStore();
    const a2 = await book(s2, A, { date: "2026-10-20" }, "confirmed");
    const free = await submitChangeRequest(s2, A, a2.bookingId, modification({ eventDate: "2026-11-02" }), { now: NOW });
    assert.ok(free.ok);
    assert.equal(free.request.requestedSlot?.stateAtRequest, "available");
    assert.equal(s2.lockFor("2026-11-02__main-hall__day"), null, "the requested slot must not be claimed");
    assert.equal(s.lockCount(), locks);
    assert.equal((await s.getBooking(a.bookingId))!.eventDate, "2026-10-20");
  });

  it("one open request of each kind; an open cancellation blocks new change requests", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A);
    assert.ok((await submitChangeRequest(s, A, a.bookingId, modification({ guestCount: 500 }), { now: NOW })).ok);
    assert.deepEqual(await submitChangeRequest(s, A, a.bookingId, modification({ guestCount: 550 }), { now: NOW }), {
      ok: false,
      code: "request_exists",
    });
    assert.ok((await submitChangeRequest(s, A, a.bookingId, cancellation("Plans changed"), { now: NOW })).ok);
    assert.deepEqual(await submitChangeRequest(s, A, a.bookingId, cancellation(), { now: NOW }), { ok: false, code: "request_exists" });
  });

  it("the same submission sent twice (even simultaneously) stores one request", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A);
    const req = cancellation();
    const [one, two] = await Promise.all([
      submitChangeRequest(s, A, a.bookingId, req, { now: NOW }),
      submitChangeRequest(s, A, a.bookingId, req, { now: NOW }),
    ]);
    assert.ok(one.ok && two.ok);
    assert.equal(s.requestCount(), 1);
    assert.equal([one, two].filter((r) => r.ok && r.duplicate).length, 1);
  });

  it("B reusing A's request key cannot see or touch A's request", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, { date: "2026-10-20" });
    const b = await book(s, B, { date: "2026-10-21" });
    const req = cancellation();
    assert.ok((await submitChangeRequest(s, A, a.bookingId, req, { now: NOW })).ok);
    const other = await submitChangeRequest(s, B, b.bookingId, req, { now: NOW });
    assert.ok(other.ok && !other.duplicate && other.request.customerId === B.uid);
    assert.equal((await listOwnRequests(s, A.uid)).length, 1);
    assert.equal((await listOwnRequests(s, B.uid)).length, 1);
  });

  it("no requests for completed, cancelled or past bookings", async () => {
    const s = new MemoryBookingStore();
    const done = await book(s, A, { date: "2026-10-20" }, "completed");
    const gone = await book(s, A, { date: "2026-10-21" }, "cancelled");
    for (const b of [done, gone]) {
      assert.deepEqual(await submitChangeRequest(s, A, b.bookingId, cancellation(), { now: NOW }), { ok: false, code: "not_allowed" });
    }
    const upcoming = await book(s, A, { date: "2026-10-22" });
    const later = new Date(Date.parse("2026-10-23T06:00:00Z"));
    assert.deepEqual(await submitChangeRequest(s, A, upcoming.bookingId, cancellation(), { now: later }), {
      ok: false,
      code: "not_allowed",
    });
  });

  it("asking for what the booking already has is refused", async () => {
    const s = new MemoryBookingStore();
    const a = await book(s, A, { guestCount: 400, slotId: "day" });
    assert.deepEqual(await submitChangeRequest(s, A, a.bookingId, modification({ guestCount: 400, slotId: "day" }), { now: NOW }), {
      ok: false,
      code: "no_changes",
    });
  });
});

describe("change-request validation (server-side)", () => {
  const codes = (raw: unknown) => {
    const v = validateChangeRequest(raw, TODAY, DEFAULT_CONFIG);
    return v.ok ? {} : Object.fromEntries(Object.entries(v.errors).map(([k, e]) => [k, e!.code]));
  };
  const key = "abcdefghijklmnop-1234";

  it("rejects fields a customer must never set", () => {
    for (const field of ["customerId", "status", "bookingId", "decidedAt", "pricing", "advanceReceived"]) {
      assert.deepEqual(codes({ type: "cancellation", requestKey: key, [field]: "x" }), { body: "unexpected_field" }, field);
    }
    for (const field of ["status", "customerId", "paymentReceived", "adminNotes", "hallId"]) {
      assert.deepEqual(codes({ type: "modification", requestKey: key, changes: { [field]: "x" } }), { body: "unexpected_field" }, field);
    }
  });

  it("validates each requested value", () => {
    const m = (changes: object) => codes({ type: "modification", requestKey: key, changes });
    assert.deepEqual(m({ guestCount: 1001 }), { guestCount: "capacity_exceeded" });
    assert.deepEqual(m({ guestCount: 0 }), { guestCount: "invalid_guest_count" });
    assert.deepEqual(m({ eventDate: "2026-09-30" }), { eventDate: "past_date" });
    assert.deepEqual(m({ eventDate: "2026-02-30" }), { eventDate: "invalid_date" });
    assert.deepEqual(m({ slotId: "evening" }), { slotId: "invalid_slot" });
    assert.deepEqual(m({ serviceIds: ["decoration"] }), { serviceIds: "invalid_service" });
    assert.deepEqual(m({ menuPreferenceId: "w99" }), { menuPreferenceId: "invalid_menu" });
    assert.deepEqual(m({}), { changes: "no_changes" });
    assert.deepEqual(m({ menuPreferenceId: null }), {});
    assert.deepEqual(codes({ type: "delete", requestKey: key }), { type: "invalid_type" });
    assert.deepEqual(codes({ type: "cancellation", requestKey: "short" }), { requestKey: "invalid_request_key" });
    assert.deepEqual(codes({ type: "cancellation", requestKey: key, changes: { guestCount: 1 } }), { changes: "unexpected_changes" });
  });
});

describe("portal read model", () => {
  const view = (b: BookingRecord) => toCustomerView(b, NOW);

  it("never exposes staff-only fields or the customer's uid", async () => {
    const s = new MemoryBookingStore();
    const v = view(await book(s, A));
    const keys = Object.keys(v);
    for (const hidden of ["adminNotes", "createdBy", "customerId", "slotKey", "holdExpiresAt", "customer"]) {
      assert.ok(!keys.includes(hidden), hidden);
    }
  });

  it("timeline shows only steps with real timestamps, in order", async () => {
    const s = new MemoryBookingStore();
    const pending = view(await book(s, A, { date: "2026-10-20" }));
    assert.deepEqual(pending.timeline.map((t) => t.key), ["submittedAt"]);
    const done = view(await book(s, A, { date: "2026-10-21" }, "completed"));
    assert.deepEqual(done.timeline.map((t) => t.key), ["submittedAt", "confirmedAt", "completedAt"]);
    assert.equal(pending.status, "pending", "a pending booking is never shown as confirmed");
  });

  it("upcoming / past / counts / filters use real data only", async () => {
    const s = new MemoryBookingStore();
    const list = [
      view(await book(s, A, { date: "2026-10-20" })),
      view(await book(s, A, { date: "2026-10-05" }, "confirmed")),
      view(await book(s, A, { date: "2026-10-07" }, "cancelled")),
      view(await book(s, A, { date: "2026-10-08" }, "completed")),
    ];
    assert.equal(nextUpcoming(list, TODAY)?.eventDate, "2026-10-05");
    assert.deepEqual(summaryCounts(list, TODAY), { upcoming: 2, pending: 1, confirmed: 1, completed: 1, cancelled: 1 });
    assert.deepEqual(sortForCustomer(list, TODAY).map((b) => b.eventDate), ["2026-10-05", "2026-10-20", "2026-10-08", "2026-10-07"]);
    assert.deepEqual(list.filter((b) => matchesFilter(b, "past", TODAY)).map((b) => b.eventDate), ["2026-10-08"]);
    assert.deepEqual(list.filter((b) => matchesFilter(b, "cancelled", TODAY)).map((b) => b.eventDate), ["2026-10-07"]);
    assert.equal(nextUpcoming([], TODAY), null);
    assert.equal(canRequestChanges(list[3], TODAY), false);
  });

  it("a lapsed pending hold is flagged, not relabelled", async () => {
    const s = new MemoryBookingStore();
    const b = await book(s, A);
    const later = toCustomerView(b, new Date(NOW.getTime() + 49 * HOUR));
    assert.equal(later.status, "pending");
    assert.equal(later.holdLapsed, true);
    assert.equal(toCustomerView(b, NOW).holdLapsed, false);
  });

  it("pricing is null (pending) unless the booking was priced", async () => {
    const s = new MemoryBookingStore();
    const v = view(await book(s, A));
    assert.equal(v.pricing, null);
    assert.deepEqual(v.payment, { advanceRequired: null, advanceReceived: 0, balanceDue: null });
  });
});

describe("profile update validation", () => {
  it("accepts name and optional phone", () => {
    assert.deepEqual(validateProfileUpdate({ name: "  Ayesha Khan ", phone: "0300 1234567" }), {
      ok: true,
      value: { name: "Ayesha Khan", phone: "0300 1234567" },
    });
    assert.deepEqual(validateProfileUpdate({ name: "Ayesha", phone: "" }), { ok: true, value: { name: "Ayesha", phone: null } });
  });

  it("refuses identity, role and server-managed fields", () => {
    for (const field of ["role", "admin", "uid", "email", "emailVerified", "authProvider", "createdAt", "updatedAt", "customerId"]) {
      const v = validateProfileUpdate({ name: "Ayesha", [field]: "x" });
      assert.ok(!v.ok && v.errors.body?.code === "unexpected_field", field);
    }
  });

  it("validates name and phone", () => {
    assert.ok(!validateProfileUpdate({ name: "A" }).ok);
    assert.ok(!validateProfileUpdate({ name: "Ayesha", phone: "123" }).ok);
    assert.ok(!validateProfileUpdate({ name: "Ayesha", phone: "call me" }).ok);
    assert.ok(!validateProfileUpdate(null).ok);
  });
});
