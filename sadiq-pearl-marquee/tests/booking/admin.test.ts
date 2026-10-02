// Super Admin booking management (Phase 5): status actions, request decisions,
// manual bookings, audit trail and CONCURRENCY. In-memory transactional store
// (Firestore-like rules; see memory-store.ts). Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  adminSetStatus,
  adminUpdateNotes,
  decideRequest,
  validateManualBooking,
} from "../../src/lib/booking/admin.ts";
import {
  aggregateCustomers,
  applyAdminListQuery,
  parseAdminListQuery,
  toAdminRow,
} from "../../src/lib/booking/admin-view.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest, createManualBooking } from "../../src/lib/booking/engine.ts";
import type { BookingRecord } from "../../src/lib/booking/model.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { testConfig } from "./test-config.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const ADMIN2 = { uid: "admin-2", email: "admin2@example.test" };
const cust = (n: number) => ({ uid: `cust-${n}`, email: `c${n}@example.test` });
const HOUR = 3_600_000;
const TODAY = "2026-10-01";

async function request(s: MemoryBookingStore, who = cust(1), over = {}) {
  const r = await createCustomerBookingRequest(s, who, input(over), { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  return r.booking;
}
async function modification(s: MemoryBookingStore, who: { uid: string }, bookingId: string, changes: object, now = NOW) {
  const v = validateChangeRequest({ type: "modification", changes, requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
  assert.ok(v.ok, JSON.stringify(v));
  const r = await submitChangeRequest(s, who, bookingId, v.value, { now });
  assert.ok(r.ok, JSON.stringify(r));
  return r.request;
}
async function cancellation(s: MemoryBookingStore, who: { uid: string }, bookingId: string) {
  const v = validateChangeRequest({ type: "cancellation", requestKey: randomUUID() }, TODAY, DEFAULT_CONFIG);
  assert.ok(v.ok);
  const r = await submitChangeRequest(s, who, bookingId, v.value, { now: NOW });
  assert.ok(r.ok, JSON.stringify(r));
  return r.request;
}
const booking = async (s: MemoryBookingStore, id: string) => (await s.getBooking(id))!;
const locksOf = (s: MemoryBookingStore, bookingId: string) => s.allLocks().filter((l) => l.bookingId === bookingId);

describe("admin status actions", () => {
  it("confirm: re-checks the slot, keeps the lock, stamps confirmedAt and writes an audit record", async () => {
    const s = new MemoryBookingStore();
    const b = await request(s);
    const r = await adminSetStatus(s, ADMIN, b.bookingId, "confirmed", { now: NOW });
    assert.ok(r.ok);
    const after = await booking(s, b.bookingId);
    assert.equal(after.status, "confirmed");
    assert.ok(after.timeline.confirmedAt);
    assert.equal(s.lockFor(b.slotKey)?.status, "confirmed");
    const audit = await s.listAuditForBooking(b.bookingId, 10);
    assert.deepEqual(audit.map((a) => [a.action, a.actor.uid]), [["booking_confirmed", "admin-1"]]);
  });

  it("confirm fails safely when another booking took the slot after the hold lapsed", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1));
    const later = new Date(NOW.getTime() + 49 * HOUR);
    const b = await createCustomerBookingRequest(s, cust(2), input(), { now: later });
    assert.ok(b.ok);
    const r = await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: later });
    assert.deepEqual(r, { ok: false, code: "invalid_transition" }, "A was marked expired when B took the slot");
    assert.equal(s.lockFor(a.slotKey)?.bookingId, b.booking.bookingId);
  });

  it("defence in depth: even with inconsistent data, confirm never steals a slot held by another active booking", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1));
    const b = await request(s, cust(2), { date: "2026-10-21" });
    // Corrupt the data on purpose: A's slot lock now points at B (active), A still "pending".
    s.seed({ locks: [{ ...s.lockFor(a.slotKey)!, bookingId: b.bookingId, status: "confirmed", holdExpiresAt: null }] });
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW }), { ok: false, code: "slot_unavailable" });
    assert.equal(s.lockFor(a.slotKey)?.bookingId, b.bookingId);
    assert.equal((await booking(s, a.bookingId)).status, "pending");
  });

  it("a lapsed hold can still be confirmed when the slot is free", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: new Date(NOW.getTime() + 60 * HOUR) })).ok);
  });

  it("stale page: a booking changed since the admin loaded it is not changed", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    const seen = new Date(a.updatedAt).toISOString();
    assert.ok((await adminSetStatus(s, ADMIN2, a.bookingId, "under_review", { now: new Date(NOW.getTime() + 1000) })).ok);
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { expectedUpdatedAt: seen, now: NOW }), {
      ok: false,
      code: "stale",
    });
    assert.equal((await booking(s, a.bookingId)).status, "under_review");
  });

  it("reject keeps the record, releases the slot and stores the reason in the audit trail", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { reason: "Date reserved for maintenance", now: NOW })).ok);
    assert.equal((await booking(s, a.bookingId)).status, "rejected");
    assert.equal(s.lockFor(a.slotKey), null);
    const [audit] = await s.listAuditForBooking(a.bookingId, 5);
    assert.equal(audit.reason, "Date reserved for maintenance");
    assert.ok((await request(s, cust(2))).bookingId, "the slot is bookable again");
  });

  it("cancel releases the slot and closes the booking's open requests", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW });
    const req = await modification(s, cust(1), a.bookingId, { guestCount: 500 });
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "cancelled", { now: NOW })).ok);
    assert.equal(s.lockFor(a.slotKey), null);
    assert.ok((await booking(s, a.bookingId)).timeline.cancelledAt);
    assert.equal((await s.getRequest(req.requestId))?.status, "declined");
  });

  it("server-side transition map: invalid actions and transitions are refused", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "expired", { now: NOW }), { ok: false, code: "invalid_action" });
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "deleted", { now: NOW }), { ok: false, code: "invalid_action" });
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "completed", { now: NOW }), { ok: false, code: "event_not_over" });
    await adminSetStatus(s, ADMIN, a.bookingId, "rejected", { now: NOW });
    assert.deepEqual(await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW }), { ok: false, code: "invalid_transition" });
    assert.deepEqual(await adminSetStatus(s, ADMIN, "bk_missing", "confirmed", { now: NOW }), { ok: false, code: "not_found" });
  });

  it("completed is allowed on/after the event date", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1), { date: "2026-10-02" });
    await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW });
    assert.ok((await adminSetStatus(s, ADMIN, a.bookingId, "completed", { now: new Date("2026-10-02T15:00:00Z") })).ok);
  });

  it("the pending-hold policy is unchanged (48 hours)", () => {
    assert.equal(DEFAULT_CONFIG.rules.pendingHoldHours, 48);
    assert.equal(DEFAULT_CONFIG.rules.bookingHorizonDays, 730);
  });
});

describe("admin notes", () => {
  it("are saved for admins, audited without their content, and never reach the customer view", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    assert.ok((await adminUpdateNotes(s, ADMIN, a.bookingId, "VIP family — call before confirming", { now: NOW })).ok);
    const stored = await booking(s, a.bookingId);
    assert.equal(stored.adminNotes, "VIP family — call before confirming");
    const view = toCustomerView(stored, NOW);
    assert.ok(!JSON.stringify(view).includes("VIP family"));
    const [audit] = await s.listAuditForBooking(a.bookingId, 5);
    assert.equal(audit.action, "admin_notes_updated");
    assert.ok(!JSON.stringify(audit).includes("VIP family"));
    assert.deepEqual(await adminUpdateNotes(s, ADMIN, a.bookingId, "x".repeat(5000)), { ok: false, code: "invalid_notes" });
  });
});

describe("modification approval (atomic)", () => {
  it("moves the booking to a free slot: claim new, update booking, release old, close request — together", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1), { date: "2026-10-20", slotId: "day" });
    await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW });
    const req = await modification(s, cust(1), a.bookingId, { eventDate: "2026-10-25", slotId: "night", guestCount: 700 });
    const r = await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW });
    assert.ok(r.ok, JSON.stringify(r));
    const after = await booking(s, a.bookingId);
    assert.deepEqual([after.eventDate, after.slotId, after.guestCount, after.status], ["2026-10-25", "night", 700, "confirmed"]);
    assert.equal(s.lockFor("2026-10-20__main-hall__day"), null, "old slot released");
    assert.equal(s.lockFor("2026-10-25__main-hall__night")?.bookingId, a.bookingId, "new slot claimed");
    assert.equal((await s.getRequest(req.requestId))?.status, "accepted");
    assert.deepEqual((await s.listAuditForBooking(a.bookingId, 5)).map((x) => x.action).sort(), ["booking_confirmed", "modification_approved"]);
  });

  it("requested slot taken: nothing changes (booking, old slot, request)", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s, cust(1), { date: "2026-10-20" });
    await request(s, cust(2), { date: "2026-10-25" });
    const req = await modification(s, cust(1), a.bookingId, { eventDate: "2026-10-25" });
    const r = await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW });
    assert.deepEqual(r, { ok: false, code: "slot_unavailable" });
    assert.equal((await booking(s, a.bookingId)).eventDate, "2026-10-20");
    assert.equal(s.lockFor(a.slotKey)?.bookingId, a.bookingId, "old slot still held");
    assert.equal((await s.getRequest(req.requestId))?.status, "open");
  });

  it("pricing: re-quoted when prices exist; otherwise marked pending (no invented totals)", async () => {
    const s = new MemoryBookingStore();
    const prices = testConfig({ hallRent: { "main-hall": 1000 }, perGuestRate: 10 });
    const priced = await createCustomerBookingRequest(s, cust(1), input({ guestCount: 100 }), { now: NOW, config: prices });
    assert.ok(priced.ok && priced.booking.pricing?.total === 2000);
    const req = await modification(s, cust(1), priced.booking.bookingId, { guestCount: 200 });
    assert.ok((await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW, config: prices })).ok);
    assert.equal((await booking(s, priced.booking.bookingId)).pricing?.total, 3000);
    const req2 = await modification(s, cust(1), priced.booking.bookingId, { guestCount: 250 });
    assert.ok((await decideRequest(s, ADMIN, req2.requestId, "approve", { now: NOW })).ok); // real (unconfigured) prices
    const after = await booking(s, priced.booking.bookingId);
    assert.equal(after.pricing, null);
    assert.deepEqual(after.payment, { currency: "PKR", advanceRequired: null, advanceReceived: 0, balanceDue: null });
  });

  it("reject leaves the booking untouched and closes the request", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    const req = await modification(s, cust(1), a.bookingId, { guestCount: 900 });
    assert.ok((await decideRequest(s, ADMIN, req.requestId, "reject", { reason: "Hall setup", now: NOW })).ok);
    assert.equal((await booking(s, a.bookingId)).guestCount, 400);
    assert.equal((await s.getRequest(req.requestId))?.status, "declined");
    assert.deepEqual(await decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW }), { ok: false, code: "not_open" });
  });

  it("cancellation approval cancels, releases the slot and closes other open requests", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    const mod = await modification(s, cust(1), a.bookingId, { guestCount: 500 });
    const can = await cancellation(s, cust(1), a.bookingId);
    assert.ok((await decideRequest(s, ADMIN, can.requestId, "approve", { now: NOW })).ok);
    assert.equal((await booking(s, a.bookingId)).status, "cancelled");
    assert.deepEqual(locksOf(s, a.bookingId), []);
    assert.equal((await s.getRequest(mod.requestId))?.status, "declined");
  });
});

describe("CONCURRENCY (in-memory transactional store)", () => {
  it("confirmation race: admin confirms a lapsed request while a customer books the same slot — only one holds it", async () => {
    for (let run = 0; run < 10; run++) {
      const s = new MemoryBookingStore();
      const a = await request(s, cust(1));
      const later = new Date(NOW.getTime() + 49 * HOUR);
      const [confirm, website] = await Promise.all([
        adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: later }),
        createCustomerBookingRequest(s, cust(2), input(), { now: later }),
      ]);
      assert.equal([confirm.ok, website.ok].filter(Boolean).length, 1, `run ${run}: ${JSON.stringify([confirm, website])}`);
      const lock = s.lockFor(a.slotKey)!;
      const holder = confirm.ok ? a.bookingId : (website as { booking: BookingRecord }).booking.bookingId;
      assert.equal(lock.bookingId, holder);
      assert.equal(s.allLocks().length, 1);
    }
  });

  it("two admins confirming the same booking at once: exactly one confirmation, one audit record", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    const results = await Promise.all([
      adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW }),
      adminSetStatus(s, ADMIN2, a.bookingId, "confirmed", { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await s.listAuditForBooking(a.bookingId, 10)).length, 1);
    assert.ok(s.retries >= 1, "the second transaction really conflicted");
  });

  it("modification race: two approvals claiming the same new slot — only one succeeds, the loser is untouched", async () => {
    for (let run = 0; run < 10; run++) {
      const s = new MemoryBookingStore();
      const a = await request(s, cust(1), { date: "2026-10-20" });
      const b = await request(s, cust(2), { date: "2026-10-21" });
      const ra = await modification(s, cust(1), a.bookingId, { eventDate: "2026-10-30" });
      const rb = await modification(s, cust(2), b.bookingId, { eventDate: "2026-10-30" });
      const [x, y] = await Promise.all([
        decideRequest(s, ADMIN, ra.requestId, "approve", { now: NOW }),
        decideRequest(s, ADMIN2, rb.requestId, "approve", { now: NOW }),
      ]);
      assert.equal([x.ok, y.ok].filter(Boolean).length, 1, `run ${run}`);
      assert.deepEqual([x, y].find((r) => !r.ok), { ok: false, code: "slot_unavailable" });
      const winner = x.ok ? a : b;
      const loser = x.ok ? b : a;
      assert.equal(s.lockFor("2026-10-30__main-hall__day")?.bookingId, winner.bookingId);
      assert.equal(s.lockFor(winner.slotKey), null, "winner's old slot released");
      assert.equal(s.lockFor(loser.slotKey)?.bookingId, loser.bookingId, "loser keeps its slot");
      assert.equal((await booking(s, loser.bookingId)).eventDate, loser.eventDate);
      assert.equal(s.allLocks().length, 2);
    }
  });

  it("manual booking vs website booking for the same slot — only one succeeds", async () => {
    for (let run = 0; run < 10; run++) {
      const s = new MemoryBookingStore();
      const [manual, web] = await Promise.all([
        createManualBooking(s, ADMIN, { ...input(), source: "walk_in", status: "confirmed", customerId: null, email: null }, { now: NOW }),
        createCustomerBookingRequest(s, cust(1), input(), { now: NOW }),
      ]);
      assert.equal([manual.ok, web.ok].filter(Boolean).length, 1, `run ${run}`);
      assert.equal(s.bookingCount(), 1);
      assert.equal(s.allLocks().length, 1);
    }
  });

  it("cancellation vs modification approved at the same time — final state stays consistent", async () => {
    for (let run = 0; run < 10; run++) {
      const s = new MemoryBookingStore();
      const a = await request(s, cust(1), { date: "2026-10-20" });
      await adminSetStatus(s, ADMIN, a.bookingId, "confirmed", { now: NOW });
      const mod = await modification(s, cust(1), a.bookingId, { eventDate: "2026-11-05", slotId: "night" });
      const can = await cancellation(s, cust(1), a.bookingId);
      const [m, c] = await Promise.all([
        decideRequest(s, ADMIN, mod.requestId, "approve", { now: NOW }),
        decideRequest(s, ADMIN2, can.requestId, "approve", { now: NOW }),
      ]);
      assert.ok(c.ok, `run ${run}: the cancellation always applies (${JSON.stringify(c)})`);
      const final = await booking(s, a.bookingId);
      assert.equal(final.status, "cancelled");
      assert.deepEqual(locksOf(s, a.bookingId), [], "no slot (old or new) is left held by a cancelled booking");
      assert.equal(s.allLocks().length, 0);
      const modFinal = (await s.getRequest(mod.requestId))!.status;
      assert.ok(m.ok ? modFinal === "accepted" : modFinal === "declined", `run ${run}: ${JSON.stringify(m)} / ${modFinal}`);
    }
  });

  it("approve and reject of the same request at once — exactly one decision", async () => {
    const s = new MemoryBookingStore();
    const a = await request(s);
    const req = await modification(s, cust(1), a.bookingId, { guestCount: 300 });
    const results = await Promise.all([
      decideRequest(s, ADMIN, req.requestId, "approve", { now: NOW }),
      decideRequest(s, ADMIN2, req.requestId, "reject", { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.deepEqual(results.find((r) => !r.ok), { ok: false, code: "not_open" });
  });
});

describe("manual bookings", () => {
  it("go through the same engine: audited, offline customer allowed, slot locks respected", async () => {
    const s = new MemoryBookingStore();
    const v = validateManualBooking({ ...input(), source: "phone", status: "confirmed", customerId: null, email: "" }, TODAY, DEFAULT_CONFIG);
    assert.ok(v.ok, JSON.stringify(v));
    const r = await createManualBooking(s, ADMIN, v.value, { now: NOW });
    assert.ok(r.ok && r.booking.source === "phone" && r.booking.customerId === null && r.booking.status === "confirmed");
    assert.deepEqual(r.booking.createdBy, { kind: "admin", uid: "admin-1" });
    assert.equal((await s.listAuditForBooking(r.booking.bookingId, 5))[0].action, "booking_created_manual");
    const again = await createManualBooking(s, ADMIN, { ...v.value, requestKey: randomUUID() }, { now: NOW });
    assert.deepEqual(again, { ok: false, code: "slot_unavailable" });
  });

  it("validation: website source, unknown status, bad email, past date and over-capacity are refused", () => {
    const codes = (over: object) => {
      const v = validateManualBooking({ ...input(), source: "walk_in", status: "pending", customerId: null, ...over }, TODAY, DEFAULT_CONFIG);
      return v.ok ? [] : Object.values(v.errors).map((e) => e!.code).sort();
    };
    assert.deepEqual(codes({}), []);
    assert.deepEqual(codes({ source: "website" }), ["invalid_source"]);
    assert.deepEqual(codes({ source: "instagram" }), ["invalid_source"]);
    assert.deepEqual(codes({ status: "completed" }), ["invalid_status"]);
    assert.deepEqual(codes({ email: "not-an-email" }), ["invalid_email"]);
    assert.deepEqual(codes({ date: "2026-09-01" }), ["past_date"]);
    assert.deepEqual(codes({ guestCount: 1001 }), ["capacity_exceeded"]);
    assert.deepEqual(codes({ adminNotes: "x" }), ["unexpected_field"]);
  });
});

describe("admin list & customers read model", () => {
  it("filters, searches, sorts and paginates on the server within a bounded window", async () => {
    const s = new MemoryBookingStore();
    for (let i = 0; i < 30; i++) {
      await request(s, cust(i), { date: `2026-11-${String((i % 28) + 1).padStart(2, "0")}`, slotId: i < 28 ? "day" : "night", contactName: `Guest ${i}` });
    }
    const rows = (await s.listBookingsInRange({ from: "2026-10-01", to: "2027-01-01", limit: 1000 })).map((b) => toAdminRow(b, NOW));
    const q = parseAdminListQuery({ slot: "night" }, TODAY);
    assert.equal(applyAdminListQuery(rows, q).total, 2);
    const page1 = applyAdminListQuery(rows, parseAdminListQuery({}, TODAY));
    assert.deepEqual([page1.total, page1.pages, page1.rows.length], [30, 2, 25]);
    assert.equal(applyAdminListQuery(rows, parseAdminListQuery({ q: "Guest 17" }, TODAY)).total, 1);
    const wide = parseAdminListQuery({ from: "2026-01-01", to: "2030-01-01" }, TODAY);
    assert.equal(wide.to, "2027-02-05", "range is capped at 400 days");
    const bad = parseAdminListQuery({ status: "hacked", source: "x", sort: "drop table" }, TODAY);
    assert.deepEqual([bad.status, bad.source, bad.sort], ["", "", "date_asc"]);
  });

  it("customers come from Firebase users plus offline contacts on staff bookings", async () => {
    const s = new MemoryBookingStore();
    const online = await request(s, cust(1), { date: "2026-10-20" });
    const walkIn = await createManualBooking(
      s,
      ADMIN,
      { ...input({ date: "2026-10-22", contactName: "Walk In", contactPhone: "0300-111 2222" }), source: "walk_in", status: "confirmed", customerId: null, email: null },
      { now: NOW }
    );
    assert.ok(walkIn.ok);
    const rows = aggregateCustomers(
      [{ uid: "cust-1", name: "One", email: "c1@example.test", phone: null }, { uid: "cust-9", name: "No bookings", email: "c9@example.test", phone: null }],
      [online, walkIn.booking]
    );
    assert.deepEqual(
      rows.map((r) => [r.uid, r.name, r.bookingCount]),
      [[null, "Walk In", 1], ["cust-1", "One", 1], ["cust-9", "No bookings", 0]]
    );
  });
});
