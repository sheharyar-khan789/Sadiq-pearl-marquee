// Pure booking rules: dates/time zone, validation, capacity, statuses,
// availability computation, slot keys and pricing. Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAvailability, slotStateFor } from "../../src/lib/booking/availability.ts";
import { DEFAULT_CONFIG, getHall, getSlot } from "../../src/lib/booking/catalog.ts";
import { addDays, businessToday, isIsoDate } from "../../src/lib/booking/dates.ts";
import { lockIsActive, slotKey, type SlotLock } from "../../src/lib/booking/model.ts";
import { quote } from "../../src/lib/booking/pricing.ts";
import { testConfig, testService } from "./test-config.ts";
import { canTransition, holdsSlot, isBookingStatus } from "../../src/lib/booking/status.ts";
import { validateBookingRequest } from "../../src/lib/booking/validation.ts";

const TODAY = "2026-10-01";
const valid = {
  date: "2026-10-20",
  hallId: "main-hall",
  slotId: "night",
  eventTypeId: "mehndi",
  guestCount: 250,
  contactName: "Test Customer",
  contactPhone: "+92 300 1234567",
  requestKey: "abcdef0123456789-key",
};
const errorsFor = (over: Record<string, unknown>) => {
  const r = validateBookingRequest({ ...valid, ...over }, TODAY, DEFAULT_CONFIG);
  return r.ok ? {} : Object.fromEntries(Object.entries(r.errors).map(([k, v]) => [k, v!.code]));
};

describe("dates & business time zone", () => {
  it("accepts only real YYYY-MM-DD dates", () => {
    assert.ok(isIsoDate("2026-10-20"));
    assert.ok(isIsoDate("2028-02-29"));
    for (const bad of ["2026-02-30", "2027-02-29", "2026-13-01", "20-10-2026", "2026-1-5", "2026/10/20", "2026-10-20T00:00", "", 20261020, null]) {
      assert.equal(isIsoDate(bad), false, String(bad));
    }
  });

  it("uses Pakistan time, not UTC or the browser, for 'today'", () => {
    assert.equal(businessToday(new Date("2026-10-19T18:59:00Z")), "2026-10-19"); // 23:59 PKT
    assert.equal(businessToday(new Date("2026-10-19T19:00:00Z")), "2026-10-20"); // 00:00 PKT, still the 19th in UTC
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  });
});

describe("request validation", () => {
  it("accepts a valid request and normalises it", () => {
    const r = validateBookingRequest({ ...valid, contactName: "  Test Customer  " }, TODAY, DEFAULT_CONFIG);
    assert.ok(r.ok);
    assert.equal(r.value.contactName, "Test Customer");
    assert.equal(r.value.menuPreferenceId, null);
    assert.deepEqual(r.value.serviceIds, []);
  });

  it("guest count: valid, zero, negative, fractional, text, over capacity, boundary", () => {
    assert.deepEqual(errorsFor({ guestCount: 1 }), {});
    assert.deepEqual(errorsFor({ guestCount: 1000 }), {});
    assert.deepEqual(errorsFor({ guestCount: 1001 }), { guestCount: "capacity_exceeded" });
    assert.deepEqual(errorsFor({ guestCount: 0 }), { guestCount: "invalid_guest_count" });
    assert.deepEqual(errorsFor({ guestCount: -20 }), { guestCount: "invalid_guest_count" });
    assert.deepEqual(errorsFor({ guestCount: 12.5 }), { guestCount: "invalid_guest_count" });
    assert.deepEqual(errorsFor({ guestCount: "300" }), { guestCount: "invalid_guest_count" });
    assert.deepEqual(errorsFor({ guestCount: Number.NaN }), { guestCount: "invalid_guest_count" });
  });

  it("dates: malformed, impossible, past, today and too far ahead", () => {
    assert.deepEqual(errorsFor({ date: "20/10/2026" }), { date: "invalid_date" });
    assert.deepEqual(errorsFor({ date: "2026-02-30" }), { date: "invalid_date" });
    assert.deepEqual(errorsFor({ date: "2026-09-30" }), { date: "past_date" });
    assert.deepEqual(errorsFor({ date: TODAY }), {});
    assert.deepEqual(errorsFor({ date: "2029-01-01" }), { date: "beyond_horizon" });
  });

  it("only known halls, slots, event types, menus and services", () => {
    assert.deepEqual(errorsFor({ hallId: "rooftop" }), { hallId: "invalid_hall" });
    assert.deepEqual(errorsFor({ slotId: "evening" }), { slotId: "invalid_slot" });
    assert.deepEqual(errorsFor({ slotId: "Day" }), { slotId: "invalid_slot" });
    assert.deepEqual(errorsFor({ eventTypeId: "concert" }), { eventTypeId: "invalid_event_type" });
    assert.deepEqual(errorsFor({ menuPreferenceId: "w3" }), {});
    assert.deepEqual(errorsFor({ menuPreferenceId: "w99" }), { menuPreferenceId: "invalid_menu" });
    assert.deepEqual(errorsFor({ serviceIds: ["decoration"] }), { serviceIds: "invalid_service" });
  });

  it("rejects fields a customer must never set (identity, status, money, staff notes)", () => {
    for (const field of ["customerId", "status", "total", "pricing", "advanceReceived", "adminNotes", "source", "role", "bookingId"]) {
      assert.deepEqual(errorsFor({ [field]: "x" }), { body: "unexpected_field" }, field);
    }
  });

  it("contact details and request key", () => {
    assert.deepEqual(errorsFor({ contactPhone: "12345" }), { contactPhone: "invalid_phone" });
    assert.deepEqual(errorsFor({ contactPhone: "call me" }), { contactPhone: "invalid_phone" });
    assert.deepEqual(errorsFor({ contactName: "A" }), { contactName: "invalid_name" });
    assert.deepEqual(errorsFor({ customerNotes: "x".repeat(1001) }), { customerNotes: "invalid_notes" });
    assert.deepEqual(errorsFor({ requestKey: "short" }), { requestKey: "invalid_request_key" });
  });

  it("rejects non-object bodies", () => {
    for (const body of [null, [], "text", 5]) assert.equal(validateBookingRequest(body, TODAY, DEFAULT_CONFIG).ok, false);
  });
});

describe("catalog, slot key & statuses", () => {
  it("one main hall with capacity 1000, and Day/Night slots with unconfirmed times", () => {
    assert.deepEqual(DEFAULT_CONFIG.halls.map((h) => [h.id, h.capacity]), [["main-hall", 1000]]);
    assert.deepEqual(DEFAULT_CONFIG.slots.map((s) => [s.id, s.startTime, s.endTime]), [["day", null, null], ["night", null, null]]);
    assert.equal(getHall(DEFAULT_CONFIG, "Main Hall"), null);
    assert.equal(getSlot(DEFAULT_CONFIG, "DAY"), null);
  });

  it("slot key is deterministic: date__hall__slot", () => {
    assert.equal(slotKey("2026-10-20", "main-hall", "day"), "2026-10-20__main-hall__day");
  });

  it("which statuses occupy a slot", () => {
    assert.deepEqual(
      ["pending", "under_review", "confirmed", "completed", "cancelled", "rejected", "expired"].map((s) => holdsSlot(s as never)),
      [true, true, true, true, false, false, false]
    );
    assert.equal(isBookingStatus("approved"), false);
    assert.ok(canTransition("pending", "confirmed"));
    assert.equal(canTransition("cancelled", "confirmed"), false);
    assert.equal(canTransition("completed", "pending"), false);
  });

  it("a pending hold stops blocking when it expires", () => {
    const now = new Date("2026-10-01T06:00:00Z");
    assert.ok(lockIsActive({ status: "pending", holdExpiresAt: new Date(now.getTime() + 1) }, now));
    assert.equal(lockIsActive({ status: "pending", holdExpiresAt: now }, now), false);
    assert.equal(lockIsActive({ status: "pending", holdExpiresAt: null }, now), false);
    assert.ok(lockIsActive({ status: "confirmed", holdExpiresAt: null }, now));
    assert.equal(lockIsActive({ status: "cancelled", holdExpiresAt: null }, now), false);
  });
});

describe("availability computation", () => {
  const now = new Date("2026-10-01T06:00:00Z");
  const hall = DEFAULT_CONFIG.halls[0];
  const lock = (date: string, slotId: "day" | "night", status: SlotLock["status"]): SlotLock => ({
    slotKey: slotKey(date, hall.id, slotId),
    date,
    hallId: hall.id,
    slotId,
    bookingId: "bk_x",
    status,
    holdExpiresAt: status === "pending" ? new Date(now.getTime() + 3_600_000) : null,
    updatedAt: now,
  });
  const at = (locks: SlotLock[]) => buildAvailability(DEFAULT_CONFIG, hall.id, "2026-10-20", "2026-10-20", locks, now, TODAY)[0];

  it("empty / day booked / night booked / both booked", () => {
    assert.equal(at([]).status, "available");
    assert.deepEqual(at([lock("2026-10-20", "day", "confirmed")]).slots, [
      { slotId: "day", state: "booked" },
      { slotId: "night", state: "available" },
    ]);
    assert.equal(at([lock("2026-10-20", "night", "confirmed")]).status, "partial");
    assert.equal(at([lock("2026-10-20", "day", "confirmed"), lock("2026-10-20", "night", "pending")]).status, "unavailable");
  });

  it("locks for other halls or dates do not affect the day", () => {
    assert.equal(at([{ ...lock("2026-10-20", "day", "confirmed"), hallId: "other-hall" }, lock("2026-10-21", "day", "confirmed")]).status, "available");
  });

  it("held vs booked", () => {
    assert.equal(slotStateFor(lock("2026-10-20", "day", "pending"), now), "held");
    assert.equal(slotStateFor(lock("2026-10-20", "day", "under_review"), now), "held");
    assert.equal(slotStateFor(lock("2026-10-20", "day", "completed"), now), "booked");
    assert.equal(slotStateFor(undefined, now), "available");
  });
});

describe("pricing", () => {
  const req = { hallId: "main-hall", guestCount: 200, serviceIds: [] as string[], menuId: null, packageId: null };
  const now = new Date();

  it("the venue's real price list is not configured, so nothing is priced", () => {
    const q = quote(DEFAULT_CONFIG, req, now);
    assert.equal(q.status, "unpriced");
    assert.deepEqual(q.status === "unpriced" && q.missing, ["Hall rent", "Per-guest rate"]);
  });

  it("calculates from a configured price list (TEST-ONLY numbers)", () => {
    const config = testConfig(
      {
        hallRent: { "main-hall": 50_000 },
        perGuestRate: 1_000,
        smallEventSurcharge: { belowGuests: 300, perGuest: 300 },
        serviceChargePercent: 5,
        advance: { mode: "percent", value: 25 },
      },
      { services: [testService("lights", { name: "Lights", price: 10_000 })] }
    );
    const q = quote(config, { ...req, serviceIds: ["lights"] }, now);
    assert.ok(q.status === "priced");
    // 50,000 + 200×1,000 + 200×300 + 10,000 = 320,000; +5% = 336,000; 25% = 84,000
    assert.equal(q.snapshot.subtotal, 320_000);
    assert.equal(q.snapshot.serviceCharge, 16_000);
    assert.equal(q.snapshot.total, 336_000);
    assert.equal(q.snapshot.advanceRequired, 84_000);
    assert.equal(quote(config, { ...req, guestCount: 300 }, now).status === "priced" && quote(config, { ...req, guestCount: 300 }, now).status, "priced");
    const noSurcharge = quote(config, { ...req, guestCount: 300 }, now);
    assert.ok(noSurcharge.status === "priced" && !noSurcharge.snapshot.lines.some((l) => l.code === "small_event_surcharge"));
  });

  it("an unpriced service keeps the whole quote unpriced", () => {
    const config = testConfig({ hallRent: { "main-hall": 1 }, perGuestRate: 1 }, { services: [testService("x", { price: null })] });
    assert.equal(quote(config, { ...req, serviceIds: ["x"] }, now).status, "unpriced");
  });
});
