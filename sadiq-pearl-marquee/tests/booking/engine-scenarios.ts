// Booking-engine scenarios, shared by the in-memory run (engine.test.ts) and
// the Firestore-emulator run (tests/firestore/engine.firestore.test.ts).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  changeBookingStatus,
  createCustomerBookingRequest,
  createManualBooking,
  getAvailability,
  type CreateResult,
} from "../../src/lib/booking/engine.ts";
import type { BookingRecord } from "../../src/lib/booking/model.ts";
import { testConfig } from "./test-config.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import type { BookingRequestInput } from "../../src/lib/booking/validation.ts";

// 2026-10-01 11:00 in Pakistan. Event dates below are in the future relative to it.
export const NOW = new Date("2026-10-01T06:00:00Z");
const HOUR = 3_600_000;
const DATE = "2026-10-20";

export const input = (over: Partial<BookingRequestInput> = {}): BookingRequestInput => ({
  date: DATE,
  hallId: "main-hall",
  slotId: "day",
  eventTypeId: "walima",
  guestCount: 400,
  contactName: "Test Customer",
  contactPhone: "0300 1234567",
  menuPreferenceId: null,
  serviceIds: [],
  customerNotes: "",
  requestKey: randomUUID(),
  ...over,
});

const customer = (n: number) => ({ uid: `test-customer-${n}`, email: `customer-${n}@example.test` });

function booked(result: CreateResult): BookingRecord {
  assert.equal(result.ok, true, `expected success, got ${JSON.stringify(result)}`);
  return (result as Extract<CreateResult, { ok: true }>).booking;
}

async function day(store: BookingStore, date = DATE, now = NOW) {
  const result = await getAvailability(store, "main-hall", date, date, { now });
  assert.ok(result.ok);
  const [d] = result.availability.days;
  return { status: d.status, day: d.slots.find((s) => s.slotId === "day")!.state, night: d.slots.find((s) => s.slotId === "night")!.state };
}

async function readBooking(store: BookingStore, id: string) {
  return store.runTransaction(async (tx) => (await tx.getBooking(id))?.data ?? null);
}

export function defineEngineScenarios(label: string, makeStore: () => Promise<BookingStore>) {
  describe(`${label}: availability`, () => {
    it("empty date: Day and Night available", async () => {
      const s = await makeStore();
      assert.deepEqual(await day(s), { status: "available", day: "available", night: "available" });
    });

    it("Day requested: Day held, Night still available", async () => {
      const s = await makeStore();
      booked(await createCustomerBookingRequest(s, customer(1), input({ slotId: "day" }), { now: NOW }));
      assert.deepEqual(await day(s), { status: "partial", day: "held", night: "available" });
    });

    it("Night booked: Day still available", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input({ slotId: "night" }), { now: NOW }));
      assert.ok((await changeBookingStatus(s, b.bookingId, "confirmed", { now: NOW })).ok);
      assert.deepEqual(await day(s), { status: "partial", day: "available", night: "booked" });
    });

    it("both booked: the date is unavailable", async () => {
      const s = await makeStore();
      for (const slotId of ["day", "night"] as const) {
        const b = booked(await createCustomerBookingRequest(s, customer(slotId === "day" ? 1 : 2), input({ slotId }), { now: NOW }));
        assert.ok((await changeBookingStatus(s, b.bookingId, "confirmed", { now: NOW })).ok);
      }
      assert.deepEqual(await day(s), { status: "unavailable", day: "booked", night: "booked" });
    });

    it("past dates are shown as past and cannot be requested", async () => {
      const s = await makeStore();
      const result = await getAvailability(s, "main-hall", "2026-09-29", "2026-10-02", { now: NOW });
      assert.ok(result.ok);
      assert.deepEqual(result.availability.days.map((d) => d.status), ["past", "past", "available", "available"]);
      const r = await createCustomerBookingRequest(s, customer(1), input({ date: "2026-09-30" }), { now: NOW });
      assert.deepEqual(r, { ok: false, code: "invalid_request" });
    });

    it("rejects unknown halls and oversized or reversed ranges", async () => {
      const s = await makeStore();
      assert.deepEqual(await getAvailability(s, "garden", DATE, DATE, { now: NOW }), { ok: false, code: "invalid_hall" });
      assert.deepEqual(await getAvailability(s, "main-hall", "2026-10-01", "2026-12-31", { now: NOW }), { ok: false, code: "invalid_range" });
      assert.deepEqual(await getAvailability(s, "main-hall", "2026-10-05", "2026-10-01", { now: NOW }), { ok: false, code: "invalid_range" });
    });
  });

  describe(`${label}: double-booking protection`, () => {
    it("same date + hall + slot: a second customer is refused", async () => {
      const s = await makeStore();
      const first = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      const second = await createCustomerBookingRequest(s, customer(2), input(), { now: NOW });
      assert.deepEqual(second, { ok: false, code: "slot_unavailable" });
      assert.equal((await readBooking(s, first.bookingId))?.status, "pending");
    });

    it("Customer A and Customer B submitting at the same moment: exactly one succeeds", async () => {
      const s = await makeStore();
      const [a, b] = await Promise.all([
        createCustomerBookingRequest(s, customer(1), input(), { now: NOW }),
        createCustomerBookingRequest(s, customer(2), input(), { now: NOW }),
      ]);
      const wins = [a, b].filter((r) => r.ok);
      assert.equal(wins.length, 1, `results: ${JSON.stringify([a.ok, b.ok])}`);
      assert.deepEqual([a, b].find((r) => !r.ok), { ok: false, code: "slot_unavailable" });
      assert.equal((await day(s)).day, "held");
    });

    it("ten customers racing for one slot: exactly one succeeds", async () => {
      const s = await makeStore();
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => createCustomerBookingRequest(s, customer(i + 1), input(), { now: NOW }))
      );
      assert.equal(results.filter((r) => r.ok).length, 1);
      assert.ok(results.filter((r) => !r.ok).every((r) => !r.ok && r.code === "slot_unavailable"));
    });

    it("same date + hall, Day and Night: both succeed (also when simultaneous)", async () => {
      const s = await makeStore();
      const [d, n] = await Promise.all([
        createCustomerBookingRequest(s, customer(1), input({ slotId: "day" }), { now: NOW }),
        createCustomerBookingRequest(s, customer(2), input({ slotId: "night" }), { now: NOW }),
      ]);
      assert.ok(d.ok && n.ok);
      assert.equal((await day(s)).status, "unavailable");
    });

    it("different dates coexist", async () => {
      const s = await makeStore();
      booked(await createCustomerBookingRequest(s, customer(1), input({ date: "2026-10-20" }), { now: NOW }));
      booked(await createCustomerBookingRequest(s, customer(2), input({ date: "2026-10-21" }), { now: NOW }));
      assert.equal((await day(s, "2026-10-21")).day, "held");
    });

    it("a walk-in booking entered by staff blocks the website", async () => {
      const s = await makeStore();
      const walkIn = booked(
        await createManualBooking(s, { uid: "test-admin" }, { ...input(), source: "walk_in", status: "confirmed" }, { now: NOW })
      );
      assert.equal(walkIn.source, "walk_in");
      assert.equal(walkIn.customerId, null);
      assert.deepEqual(walkIn.createdBy, { kind: "admin", uid: "test-admin" });
      assert.deepEqual(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }), {
        ok: false,
        code: "slot_unavailable",
      });
      assert.equal((await day(s)).day, "booked");
    });
  });

  describe(`${label}: duplicate submission & ownership`, () => {
    it("the same request sent twice creates one booking", async () => {
      const s = await makeStore();
      const req = input();
      const [one, two] = await Promise.all([
        createCustomerBookingRequest(s, customer(1), req, { now: NOW }),
        createCustomerBookingRequest(s, customer(1), req, { now: NOW }),
      ]);
      assert.ok(one.ok && two.ok);
      assert.equal(one.booking.bookingId, two.booking.bookingId);
      assert.equal([one, two].filter((r) => r.ok && r.duplicate).length, 1);
    });

    it("another customer reusing someone's request key cannot touch their booking", async () => {
      const s = await makeStore();
      const req = input();
      const mine = booked(await createCustomerBookingRequest(s, customer(1), req, { now: NOW }));
      const theirs = await createCustomerBookingRequest(s, customer(2), { ...req, guestCount: 999 }, { now: NOW });
      assert.deepEqual(theirs, { ok: false, code: "slot_unavailable" });
      const stored = await readBooking(s, mine.bookingId);
      assert.equal(stored?.customerId, customer(1).uid);
      assert.equal(stored?.guestCount, 400);
    });

    it("the booking belongs to the server-supplied customer, with server-set status and source", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(7), input(), { now: NOW }));
      assert.equal(b.customerId, customer(7).uid);
      assert.equal(b.customer.email, customer(7).email);
      assert.equal(b.status, "pending");
      assert.equal(b.source, "website");
      assert.equal(b.adminNotes, "");
      assert.equal(b.payment.advanceReceived, 0);
    });

    it("limits how many open requests one customer can hold", async () => {
      const s = await makeStore();
      for (const date of ["2026-10-20", "2026-10-21", "2026-10-22"]) {
        booked(await createCustomerBookingRequest(s, customer(1), input({ date }), { now: NOW }));
      }
      assert.deepEqual(await createCustomerBookingRequest(s, customer(1), input({ date: "2026-10-23" }), { now: NOW }), {
        ok: false,
        code: "too_many_open_requests",
      });
      booked(await createCustomerBookingRequest(s, customer(2), input({ date: "2026-10-23" }), { now: NOW }));
    });
  });

  describe(`${label}: statuses`, () => {
    it("pending holds the slot only until its hold expires; then another customer can take it", async () => {
      const s = await makeStore();
      const old = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      const later = new Date(NOW.getTime() + 49 * HOUR);
      assert.equal((await day(s, DATE, new Date(NOW.getTime() + 47 * HOUR))).day, "held");
      assert.equal((await day(s, DATE, later)).day, "available");
      booked(await createCustomerBookingRequest(s, customer(2), input(), { now: later }));
      const displaced = await readBooking(s, old.bookingId);
      assert.equal(displaced?.status, "expired");
      assert.equal((await changeBookingStatus(s, old.bookingId, "confirmed", { now: later })).ok, false);
    });

    it("an expired hold can still be confirmed if nobody took the slot", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      const later = new Date(NOW.getTime() + 60 * HOUR);
      assert.ok((await changeBookingStatus(s, b.bookingId, "confirmed", { now: later })).ok);
      assert.equal((await day(s, DATE, later)).day, "booked");
    });

    it("under review holds the slot with no expiry", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      assert.ok((await changeBookingStatus(s, b.bookingId, "under_review", { now: NOW })).ok);
      assert.equal((await day(s, DATE, new Date(NOW.getTime() + 400 * HOUR))).day, "held");
    });

    it("confirmed blocks; cancelling releases the slot for a new booking", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      const confirmed = await changeBookingStatus(s, b.bookingId, "confirmed", { now: NOW });
      assert.ok(confirmed.ok && confirmed.booking.timeline.confirmedAt);
      assert.deepEqual(await createCustomerBookingRequest(s, customer(2), input(), { now: NOW }), { ok: false, code: "slot_unavailable" });
      const cancelled = await changeBookingStatus(s, b.bookingId, "cancelled", { now: NOW });
      assert.ok(cancelled.ok && cancelled.booking.timeline.cancelledAt);
      assert.equal((await day(s)).day, "available");
      booked(await createCustomerBookingRequest(s, customer(2), input(), { now: NOW }));
    });

    it("rejecting a request releases the slot", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      assert.ok((await changeBookingStatus(s, b.bookingId, "rejected", { now: NOW })).ok);
      assert.equal((await day(s)).day, "available");
    });

    it("completed keeps the slot occupied and is final", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      assert.ok((await changeBookingStatus(s, b.bookingId, "confirmed", { now: NOW })).ok);
      assert.ok((await changeBookingStatus(s, b.bookingId, "completed", { now: NOW })).ok);
      assert.equal((await day(s)).day, "booked");
      assert.deepEqual(await changeBookingStatus(s, b.bookingId, "cancelled", { now: NOW }), { ok: false, code: "invalid_transition" });
    });

    it("refuses transitions that are not allowed", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      assert.deepEqual(await changeBookingStatus(s, b.bookingId, "completed", { now: NOW }), { ok: false, code: "invalid_transition" });
      assert.ok((await changeBookingStatus(s, b.bookingId, "cancelled", { now: NOW })).ok);
      assert.deepEqual(await changeBookingStatus(s, b.bookingId, "confirmed", { now: NOW }), { ok: false, code: "invalid_transition" });
      assert.deepEqual(await changeBookingStatus(s, "bk_missing", "confirmed", { now: NOW }), { ok: false, code: "not_found" });
    });
  });

  describe(`${label}: validation guard & pricing snapshot`, () => {
    it("the engine itself refuses over-capacity, zero guests and unknown slots", async () => {
      const s = await makeStore();
      for (const bad of [{ guestCount: 1001 }, { guestCount: 0 }, { guestCount: -5 }, { slotId: "evening" as never }]) {
        assert.deepEqual(await createCustomerBookingRequest(s, customer(1), input(bad), { now: NOW }), {
          ok: false,
          code: "invalid_request",
        });
      }
      booked(await createCustomerBookingRequest(s, customer(1), input({ guestCount: 1000 }), { now: NOW }));
    });

    it("without configured prices, a booking stores no price or totals", async () => {
      const s = await makeStore();
      const b = booked(await createCustomerBookingRequest(s, customer(1), input(), { now: NOW }));
      assert.equal(b.pricing, null);
      assert.deepEqual(b.payment, { currency: "PKR", advanceRequired: null, advanceReceived: 0, balanceDue: null });
    });

    it("a priced booking keeps its snapshot when prices later change", async () => {
      const s = await makeStore();
      // TEST-ONLY price list; not the venue's prices.
      const prices = testConfig({ hallRent: { "main-hall": 1000 }, perGuestRate: 10, advance: { mode: "percent", value: 50 } });
      prices.version = 101;
      const b = booked(await createCustomerBookingRequest(s, customer(1), input({ guestCount: 100 }), { now: NOW, config: prices }));
      prices.pricing.perGuestRate = 99;
      prices.version = 102;
      const stored = await readBooking(s, b.bookingId);
      assert.equal(stored?.pricing?.configVersion, "101");
      assert.equal(stored?.pricing?.total, 2000);
      assert.equal(stored?.payment.advanceRequired, 1000);
      assert.equal(stored?.payment.balanceDue, 2000);
    });
  });
}
