// Phase 6: business configuration — validation, stale edits, audit, pricing,
// historical snapshots, deactivation, capacity, rules, and integration with
// the booking engine. In-memory transactional store. Run: npm run test:booking
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { decideRequest, validateManualBooking } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest, createManualBooking, getAvailability } from "../../src/lib/booking/engine.ts";
import { quote } from "../../src/lib/booking/pricing.ts";
import { toCustomerView } from "../../src/lib/booking/portal.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { validateBookingRequest } from "../../src/lib/booking/validation.ts";
import { applyConfigChange, mutateConfig, type ConfigChange } from "../../src/lib/config/config-admin.ts";
import { DEFAULT_CONFIG, normalizeConfig, toPublicConfig, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const TODAY = "2026-10-01";
const cust = (n: number) => ({ uid: `cust-${n}`, email: `c${n}@example.test` });

/** Applies changes in order (pure), failing the test on any rejection. */
function build(...changes: ConfigChange[]): BusinessConfig {
  let c = DEFAULT_CONFIG;
  for (const ch of changes) {
    const r = applyConfigChange(c, ch, "admin-1", NOW);
    assert.ok(r.ok, `${ch.section}/${ch.op ?? ""}: ${JSON.stringify(r)}`);
    c = r.config;
  }
  return c;
}
const reject = (c: BusinessConfig, ch: ConfigChange) => {
  const r = applyConfigChange(c, ch, "admin-1", NOW);
  assert.equal(r.ok, false, `${JSON.stringify(ch)} should be rejected`);
  return r as Extract<typeof r, { ok: false }>;
};

const pricing = (data: Record<string, unknown>, version = 0): ConfigChange => ({
  section: "pricing",
  expectedVersion: version,
  data: { hallRent: { "main-hall": null }, perGuestRate: null, smallEventSurcharge: null, serviceChargePercent: null, discount: null, advance: null, ...data },
});
const service = (name: string, extra: Record<string, unknown> = {}): ConfigChange => ({
  section: "services",
  op: "create",
  data: { name, description: "", active: true, sortOrder: 1, category: "decoration", pricingMode: null, price: null, ...extra },
});

describe("configuration validation (server-side)", () => {
  it("rejects invalid prices, percentages, capacity, times, names, IDs and unknown fields", () => {
    const c = DEFAULT_CONFIG;
    assert.equal(reject(c, pricing({ perGuestRate: -5 })).code, "invalid");
    assert.equal(reject(c, pricing({ perGuestRate: 12.5 })).code, "invalid");
    assert.equal(reject(c, pricing({ serviceChargePercent: 150 })).code, "invalid");
    assert.equal(reject(c, pricing({ advance: { mode: "percent", value: 101 } })).code, "invalid");
    assert.equal(reject(c, pricing({ discount: { label: "", percent: 10 } })).code, "invalid");
    assert.equal(reject(c, pricing({ hallRent: { "second-hall": 5 } })).code, "invalid");
    assert.equal(reject(c, { section: "hall", id: "main-hall", expectedVersion: 0, data: { name: "Main Hall", capacity: 0 } }).code, "invalid");
    assert.equal(reject(c, { section: "hall", id: "main-hall", expectedVersion: 0, data: { name: "", capacity: 800 } }).code, "invalid");
    const slot = (d: object) => ({ section: "slot", id: "day", expectedVersion: 0, data: { label: "Day", startTime: null, endTime: null, active: true, sortOrder: 1, ...d } });
    assert.equal(reject(c, slot({ startTime: "25:00", endTime: "18:00" })).code, "invalid");
    assert.equal(reject(c, slot({ startTime: "12:00", endTime: null })).code, "invalid");
    assert.equal(reject(c, slot({ startTime: "12:00", endTime: "12:00" })).code, "invalid");
    assert.equal(reject(c, service("")).code, "invalid");
    assert.equal(reject(c, service("Lights", { price: 5000 })).code, "invalid", "a price needs a pricing mode");
    assert.equal(reject(c, service("Lights", { category: "fireworks" })).code, "invalid");
    assert.equal(reject(c, service("Lights", { role: "admin" })).code, "invalid");
    assert.equal(reject(c, { section: "services", op: "create", data: "not an object" }).code, "invalid");
    assert.equal(reject(c, { section: "eventTypes", op: "create", data: { id: "walima", name: "Walima 2", description: "", active: true, sortOrder: 9 } }).code, "duplicate_id");
    assert.equal(reject(c, { section: "eventTypes", op: "create", data: { name: "Walima", description: "", active: true, sortOrder: 9 } }).code, "invalid", "duplicate name");
    assert.equal(reject(c, { section: "nonsense", data: {} }).code, "invalid");
  });

  it("valid values are accepted and slot times may stay 'not configured'", () => {
    const c = build(
      { section: "slot", id: "day", expectedVersion: 0, data: { label: "Day", startTime: "12:00", endTime: "16:00", active: true, sortOrder: 1 } },
      { section: "slot", id: "night", expectedVersion: 0, data: { label: "Night", startTime: null, endTime: null, active: true, sortOrder: 2 } },
      pricing({ hallRent: { "main-hall": 0 }, perGuestRate: 1500, serviceChargePercent: 5, advance: { mode: "fixed", value: 50_000 } })
    );
    assert.equal(c.slots[0].startTime, "12:00");
    assert.equal(c.slots[1].startTime, null);
    assert.equal(c.pricing.perGuestRate, 1500);
    assert.equal(c.version, 3);
  });

  it("keeps at least one active slot and one active event type", () => {
    const c = build({ section: "slot", id: "day", expectedVersion: 0, data: { label: "Day", startTime: null, endTime: null, active: false, sortOrder: 1 } });
    assert.equal(reject(c, { section: "slot", id: "night", expectedVersion: 0, data: { label: "Night", startTime: null, endTime: null, active: false, sortOrder: 2 } }).code, "invalid");
    let e = DEFAULT_CONFIG;
    for (const t of DEFAULT_CONFIG.eventTypes.slice(1)) {
      const r = applyConfigChange(e, { section: "eventTypes", op: "setActive", id: t.id, expectedVersion: 0, data: { active: false } }, "a", NOW);
      assert.ok(r.ok);
      e = r.config;
    }
    assert.equal(reject(e, { section: "eventTypes", op: "setActive", id: "wedding", expectedVersion: 0, data: { active: false } }).code, "invalid");
  });

  it("packages may only reference existing, active services and menus", () => {
    const c = build(service("Stage decor", { pricingMode: "fixed", price: 20_000 }));
    const pkg = (d: object): ConfigChange => ({ section: "packages", op: "create", data: { name: "Gold", description: "", active: true, sortOrder: 1, pricingMode: null, price: null, serviceIds: [], menuId: null, ...d } });
    assert.equal(reject(c, pkg({ serviceIds: ["ghost"] })).code, "invalid");
    assert.equal(reject(c, pkg({ menuId: "no-menu" })).code, "invalid");
    const ok = applyConfigChange(c, pkg({ serviceIds: ["stage-decor"], menuId: "w1" }), "a", NOW);
    assert.ok(ok.ok);
  });

  it("stale edits are rejected; nothing is hard-deleted (deactivate only)", () => {
    const c = build(service("Lights"));
    const s = c.services[0];
    assert.equal(reject(c, { section: "services", op: "update", id: s.id, expectedVersion: s.version + 5, data: { ...s, id: undefined, version: undefined } }).code, "stale");
    assert.equal(reject(c, { section: "services", op: "delete", id: s.id, expectedVersion: s.version }).code, "invalid");
    const off = build(service("Lights"), { section: "services", op: "setActive", id: "lights", expectedVersion: 1, data: { active: false } });
    assert.equal(off.services[0].active, false);
    assert.equal(off.services.length, 1, "still there, inactive");
  });
});

describe("configuration writes (transaction + audit + concurrency)", () => {
  it("first save creates the document; every change is audited with before/after", async () => {
    const s = new MemoryBookingStore();
    assert.equal(await s.getConfig(), null);
    const r = await mutateConfig(s, ADMIN, pricing({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1000 }), NOW);
    assert.ok(r.ok);
    const stored = normalizeConfig(await s.getConfig());
    assert.equal(stored.pricing.hallRent["main-hall"], 100_000);
    assert.equal(stored.version, 1);
    const [a] = await s.listConfigAudit(5);
    assert.deepEqual([a.action, a.entityType, a.entityId, a.actor.uid], ["config_updated", "config", "pricing", "admin-1"]);
    assert.equal((a.before as { perGuestRate: null }).perGuestRate, null);
    assert.equal((a.after as { perGuestRate: number }).perGuestRate, 1000);
    assert.ok(!JSON.stringify(a).match(/password|private|secret/i));
  });

  it("two admins saving the same section at once: one wins, the other is told it is stale", async () => {
    const s = new MemoryBookingStore();
    const [x, y] = await Promise.all([
      mutateConfig(s, ADMIN, pricing({ perGuestRate: 1000 }), NOW),
      mutateConfig(s, { uid: "admin-2", email: null }, pricing({ perGuestRate: 2000 }), NOW),
    ]);
    assert.equal([x.ok, y.ok].filter(Boolean).length, 1);
    assert.deepEqual([x, y].find((r) => !r.ok), { ok: false, code: "stale" });
    assert.equal((await s.listConfigAudit(10)).length, 1);
  });

  it("edits to different items don't block each other", async () => {
    const s = new MemoryBookingStore();
    await mutateConfig(s, ADMIN, service("Lights"), NOW);
    await mutateConfig(s, ADMIN, service("Stage"), NOW);
    const cfg = normalizeConfig(await s.getConfig());
    const lights = cfg.services.find((x) => x.id === "lights")!;
    const r = await mutateConfig(s, ADMIN, { section: "services", op: "update", id: "lights", expectedVersion: lights.version, data: { name: "Lights", description: "", active: true, sortOrder: 1, category: "lighting", pricingMode: "fixed", price: 5000 } }, NOW);
    assert.ok(r.ok, JSON.stringify(r));
  });
});

describe("pricing engine with real configuration", () => {
  const cfg = build(
    pricing({
      hallRent: { "main-hall": 100_000 },
      perGuestRate: 500,
      smallEventSurcharge: { belowGuests: 300, perGuest: 300 },
      discount: { label: "Opening offer", percent: 10 },
      serviceChargePercent: 5,
      advance: { mode: "percent", value: 30 },
    }),
    service("Stage decor", { pricingMode: "fixed", price: 40_000 }),
    service("Photography", { category: "photography", pricingMode: "per_guest", price: 100 }),
    { section: "menus", op: "update", id: "w1", expectedVersion: 0, data: { name: "Wedding Menu 1", description: "", active: true, sortOrder: 1, pricingMode: "per_guest", price: 1200, items: DEFAULT_CONFIG.menus[0].items } },
    { section: "packages", op: "create", data: { name: "Gold", description: "", active: true, sortOrder: 1, pricingMode: "per_guest", price: 2000, serviceIds: ["stage-decor"], menuId: "w1" } }
  );
  const req = (o: object) => ({ hallId: "main-hall", guestCount: 400, serviceIds: [] as string[], menuId: null, packageId: null, ...o });

  it("hall rent + per-guest + menu + services − discount + service charge; advance and remaining", () => {
    const q = quote(cfg, req({ menuId: "w1", serviceIds: ["stage-decor", "photography"] }), NOW);
    assert.ok(q.status === "priced", JSON.stringify(q));
    // 100,000 + 400×500 + 400×1,200 + 40,000 + 400×100 = 860,000
    assert.equal(q.snapshot.subtotal, 860_000);
    assert.equal(q.snapshot.discount, 86_000);
    assert.equal(q.snapshot.discountLabel, "Opening offer");
    assert.equal(q.snapshot.serviceCharge, 38_700); // 5% of 774,000
    assert.equal(q.snapshot.total, 812_700);
    assert.equal(q.snapshot.advanceRequired, 243_810); // 30%
    assert.equal(q.snapshot.configVersion, String(cfg.version));
  });

  it("a package includes its own services and menu (no double charge)", () => {
    const q = quote(cfg, req({ packageId: "gold", menuId: "w1", serviceIds: ["stage-decor", "photography"] }), NOW);
    assert.ok(q.status === "priced");
    const codes = q.snapshot.lines.map((l) => l.code);
    assert.deepEqual(codes, ["hall_rent", "per_guest", "package:gold", "service:photography"]);
  });

  it("small-event surcharge only below the configured threshold", () => {
    const small = quote(cfg, req({ guestCount: 200 }), NOW);
    assert.ok(small.status === "priced" && small.snapshot.lines.some((l) => l.code === "small_event_surcharge"));
  });

  it("missing prices make the quote 'pending' instead of inventing a total", () => {
    const partial = build(pricing({ hallRent: { "main-hall": 100_000 }, perGuestRate: 500 }), service("DJ", { category: "dj_sound" }));
    const q = quote(partial, req({ serviceIds: ["dj"], menuId: "w2" }), NOW);
    assert.equal(q.status, "unpriced");
    assert.deepEqual(q.status === "unpriced" && q.missing, ['Price for menu "Wedding Menu 2"', 'Price for "DJ"']);
    assert.equal(quote(DEFAULT_CONFIG, req({}), NOW).status, "unpriced", "nothing is priced until real prices are entered");
  });
});

describe("booking integration", () => {
  const cfg = build(
    pricing({ hallRent: { "main-hall": 100_000 }, perGuestRate: 500 }),
    service("Stage decor", { pricingMode: "fixed", price: 40_000 })
  );

  it("website booking uses the configured services/menu/package and stores their snapshot", async () => {
    const s = new MemoryBookingStore();
    const r = await createCustomerBookingRequest(s, cust(1), input({ serviceIds: ["stage-decor"], guestCount: 300 }), { now: NOW, config: cfg });
    assert.ok(r.ok);
    assert.deepEqual(r.booking.services, [{ id: "stage-decor", label: "Stage decor" }]);
    assert.equal(r.booking.pricing?.total, 100_000 + 300 * 500 + 40_000);
    assert.equal(r.booking.pricing?.configVersion, String(cfg.version));
  });

  it("staff (manual) booking uses the same validation and pricing as the website", async () => {
    const s = new MemoryBookingStore();
    const v = validateManualBooking({ ...input({ serviceIds: ["stage-decor"], guestCount: 300 }), source: "walk_in", status: "confirmed", customerId: null }, TODAY, cfg);
    assert.ok(v.ok, JSON.stringify(v));
    const manual = await createManualBooking(s, ADMIN, v.value, { now: NOW, config: cfg });
    const web = quote(cfg, { hallId: "main-hall", guestCount: 300, serviceIds: ["stage-decor"], menuId: null, packageId: null }, NOW);
    assert.ok(manual.ok && web.status === "priced");
    assert.equal(manual.booking.pricing?.total, web.snapshot.total);
    const bad = validateManualBooking({ ...input({ serviceIds: ["ghost"] }), source: "walk_in", status: "confirmed", customerId: null }, TODAY, cfg);
    assert.ok(!bad.ok);
  });

  it("changing a price later never alters existing bookings; new bookings use the new price", async () => {
    const s = new MemoryBookingStore();
    await mutateConfig(s, ADMIN, pricing({ hallRent: { "main-hall": 100_000 }, perGuestRate: 500 }), NOW);
    let live = normalizeConfig(await s.getConfig());
    const old = await createCustomerBookingRequest(s, cust(1), input({ date: "2026-10-20" }), { now: NOW, config: live });
    assert.ok(old.ok);
    const before = old.booking.pricing?.total;
    await mutateConfig(s, ADMIN, pricing({ hallRent: { "main-hall": 150_000 }, perGuestRate: 900 }, live.pricing.version), NOW);
    live = normalizeConfig(await s.getConfig());
    const stored = await s.getBooking(old.booking.bookingId);
    assert.equal(stored?.pricing?.total, before, "old booking unchanged");
    const fresh = await createCustomerBookingRequest(s, cust(2), input({ date: "2026-10-21" }), { now: NOW, config: live });
    assert.ok(fresh.ok && fresh.booking.pricing!.total > before!);
  });

  it("deactivated service: refused for new bookings, still shown on existing ones", async () => {
    const s = new MemoryBookingStore();
    const r = await createCustomerBookingRequest(s, cust(1), input({ serviceIds: ["stage-decor"] }), { now: NOW, config: cfg });
    assert.ok(r.ok);
    const off = build(
      pricing({ hallRent: { "main-hall": 100_000 }, perGuestRate: 500 }),
      service("Stage decor", { pricingMode: "fixed", price: 40_000 }),
      { section: "services", op: "setActive", id: "stage-decor", expectedVersion: 1, data: { active: false } }
    );
    const v = validateBookingRequest({ ...input({ serviceIds: ["stage-decor"] }) }, TODAY, off);
    assert.ok(!v.ok && v.errors.serviceIds?.code === "invalid_service");
    const engine = await createCustomerBookingRequest(s, cust(2), input({ date: "2026-10-22", serviceIds: ["stage-decor"] }), { now: NOW, config: off });
    assert.deepEqual(engine, { ok: false, code: "invalid_request" });
    const view = toCustomerView((await s.getBooking(r.booking.bookingId))!, NOW);
    assert.deepEqual(view.services, [{ id: "stage-decor", label: "Stage decor" }]);
    assert.ok(!toPublicConfig(off).services.some((x) => x.id === "stage-decor"), "inactive items are not offered publicly");
  });

  it("configured capacity is enforced by validation and by the engine itself", async () => {
    const small = build({ section: "hall", id: "main-hall", expectedVersion: 0, data: { name: "Main Hall", capacity: 500 } });
    const v = validateBookingRequest({ ...input({ guestCount: 600 }) }, TODAY, small);
    assert.ok(!v.ok && v.errors.guestCount?.code === "capacity_exceeded");
    const s = new MemoryBookingStore();
    assert.deepEqual(await createCustomerBookingRequest(s, cust(1), input({ guestCount: 600 }), { now: NOW, config: small }), { ok: false, code: "invalid_request" });
    assert.ok((await createCustomerBookingRequest(s, cust(1), input({ guestCount: 500 }), { now: NOW, config: small })).ok);
  });

  it("minimum guests, pending hold hours and same-day rule come from the configuration", async () => {
    const rules = (d: object): ConfigChange => ({
      section: "rules",
      expectedVersion: 0,
      data: { pendingHoldHours: 12, bookingHorizonDays: 730, sameDayBookingAllowed: false, minGuests: 100, maxOpenRequestsPerCustomer: 3, modifications: { date: false, slot: true, guestCount: true, services: true, menu: true }, ...d },
    });
    const c = build(rules({}));
    const s = new MemoryBookingStore();
    const r = await createCustomerBookingRequest(s, cust(1), input({ guestCount: 150 }), { now: NOW, config: c });
    assert.ok(r.ok);
    assert.equal(new Date(r.booking.holdExpiresAt!).getTime() - NOW.getTime(), 12 * 3_600_000);
    assert.equal(validateBookingRequest(input({ guestCount: 50 }), TODAY, c).ok, false);
    const sameDay = validateBookingRequest(input({ date: TODAY }), TODAY, c);
    assert.ok(!sameDay.ok && sameDay.errors.date?.code === "same_day_not_allowed");
    const avail = await getAvailability(s, "main-hall", TODAY, TODAY, { now: NOW, config: c });
    assert.ok(avail.ok && avail.availability.days[0].status === "closed");
    // Modification policy: date changes switched off
    const m = validateChangeRequest({ type: "modification", changes: { eventDate: "2026-11-01" }, requestKey: randomUUID() }, TODAY, c);
    assert.ok(!m.ok && m.errors.eventDate?.code === "change_not_allowed");
  });

  it("a deactivated slot is not offered; locks on the other slot keep working", async () => {
    const c = build({ section: "slot", id: "day", expectedVersion: 0, data: { label: "Day", startTime: null, endTime: null, active: false, sortOrder: 1 } });
    const s = new MemoryBookingStore();
    assert.equal(validateBookingRequest(input({ slotId: "day" }), TODAY, c).ok, false);
    assert.ok((await createCustomerBookingRequest(s, cust(1), input({ slotId: "night" }), { now: NOW, config: c })).ok);
    assert.deepEqual(await createCustomerBookingRequest(s, cust(2), input({ slotId: "night" }), { now: NOW, config: c }), { ok: false, code: "slot_unavailable" });
    const a = await getAvailability(s, "main-hall", "2026-10-20", "2026-10-20", { now: NOW, config: c });
    assert.ok(a.ok);
    assert.deepEqual(a.availability.days[0].slots, [{ slotId: "night", state: "held" }]);
  });

  it("Phase 5 modification approval still runs atomically and re-prices with the current configuration", async () => {
    const s = new MemoryBookingStore();
    const b = await createCustomerBookingRequest(s, cust(1), input({ date: "2026-10-20", guestCount: 300 }), { now: NOW, config: cfg });
    assert.ok(b.ok);
    const v = validateChangeRequest({ type: "modification", changes: { eventDate: "2026-10-28", guestCount: 400 }, requestKey: randomUUID() }, TODAY, cfg);
    assert.ok(v.ok);
    const req = await submitChangeRequest(s, cust(1), b.booking.bookingId, v.value, { now: NOW });
    assert.ok(req.ok);
    const newer = build(pricing({ hallRent: { "main-hall": 120_000 }, perGuestRate: 600 }));
    const d = await decideRequest(s, ADMIN, req.request.requestId, "approve", { now: NOW, config: newer });
    assert.ok(d.ok, JSON.stringify(d));
    const after = (await s.getBooking(b.booking.bookingId))!;
    assert.equal(after.eventDate, "2026-10-28");
    assert.equal(after.pricing?.total, 120_000 + 400 * 600);
    assert.equal(s.lockFor("2026-10-20__main-hall__day"), null);
    assert.equal(s.lockFor("2026-10-28__main-hall__day")?.bookingId, b.booking.bookingId);
  });
});
