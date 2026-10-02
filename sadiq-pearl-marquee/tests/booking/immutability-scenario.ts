// Historical financial immutability (Phase 7 carry-forward, re-verified in
// Phase 8). Shared by the in-memory test and the Firestore-emulator test so
// both run exactly the same steps. Prices are TEST FIXTURES only.
//
//  1 create booking · 2 generate quotation · 3 issue · 4 record advance (receipt)
//  6 another payment · 7–8 verify paid / remaining · 9 change EVERY pricing input
//  10–15 re-open booking, quotation, payments, receipts: unchanged
//  16–17 a new booking uses the new configuration
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation, issueQuotation, recordPayment } from "../../src/lib/booking/finance.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testService } from "./test-config.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const BUSINESS = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
const MENU = DEFAULT_CONFIG.menus[0];

/** Every pricing input configured (test values). */
export function pricedConfig(): BusinessConfig {
  const c = structuredClone(DEFAULT_CONFIG);
  c.pricing = {
    ...c.pricing,
    hallRent: { "main-hall": 100_000 },
    perGuestRate: 1_000,
    smallEventSurcharge: { belowGuests: 500, perGuest: 200 },
    serviceChargePercent: 5,
    discount: { label: "Test discount", percent: 10 },
    advance: { mode: "percent", value: 25 },
  };
  c.services = [testService("svc-light", { price: 20_000 }), testService("svc-in-pkg", { price: 5_000 })];
  c.menus = c.menus.map((m) => (m.id === MENU.id ? { ...m, pricingMode: "per_guest" as const, price: 500 } : m));
  c.packages = [
    { id: "pkg-1", name: "Test package", description: "", active: true, sortOrder: 1, serviceIds: ["svc-in-pkg"], menuId: null, pricingMode: "fixed", price: 50_000, version: 1 },
  ];
  return c;
}

/** The same configuration with EVERY price-relevant value changed. */
export function changedConfig(c: BusinessConfig): BusinessConfig {
  const n = structuredClone(c);
  n.pricing = {
    ...n.pricing,
    hallRent: { "main-hall": 175_000 },
    perGuestRate: 1_400,
    smallEventSurcharge: { belowGuests: 600, perGuest: 350 },
    serviceChargePercent: 8,
    discount: { label: "Changed discount", percent: 3 },
    advance: { mode: "fixed", value: 70_000 },
  };
  n.services = n.services.map((s) => ({ ...s, price: (s.price ?? 0) * 3 }));
  n.menus = n.menus.map((m) => (m.id === MENU.id ? { ...m, price: 900 } : m));
  n.packages = n.packages.map((p) => ({ ...p, price: 95_000 }));
  return n;
}

export async function immutabilityScenario(s: BookingStore, saveConfig: (c: BusinessConfig) => Promise<void>) {
  const c1 = pricedConfig();
  await saveConfig(c1);
  const bookingInput = input({ serviceIds: ["svc-light"], menuPreferenceId: MENU.id, packageId: "pkg-1" } as never);
  // 1. booking priced with configuration 1
  const created = await createCustomerBookingRequest(s, { uid: "c1", email: null }, bookingInput, { now: NOW, config: c1 });
  assert.ok(created.ok, JSON.stringify(created));
  const id = created.booking.bookingId;
  const pricing1 = structuredClone(created.booking.pricing);
  assert.ok(pricing1, "booking is priced");
  const codes = pricing1.lines.map((l) => l.code).sort();
  for (const expected of ["hall_rent", "per_guest", "small_event_surcharge", "package:pkg-1"]) assert.ok(codes.some((c) => c.startsWith(expected.split(":")[0])), `line ${expected} in ${codes}`);
  assert.ok((pricing1.discount ?? 0) > 0 && pricing1.serviceCharge > 0 && pricing1.advanceRequired !== null);
  // 2–3. quotation
  const draft = await generateQuotation(s, ADMIN, id, { now: NOW, config: c1, business: BUSINESS });
  assert.ok(draft.ok);
  const issued = await issueQuotation(s, ADMIN, draft.quotation.quotationId, { now: NOW });
  assert.ok(issued.ok);
  // 4–6. two payments with receipts
  const pay = (amount: number) =>
    recordPayment(s, ADMIN, id, { amount, method: "cash", paidOn: "2026-10-01", reference: "", notes: "", requestKey: randomUUID() }, { now: NOW, business: BUSINESS });
  const p1 = await pay(pricing1.advanceRequired!);
  const p2 = await pay(10_000);
  assert.ok(p1.ok && p2.ok);
  // 7–8. totals
  const paid = pricing1.advanceRequired! + 10_000;
  let b = (await s.getBooking(id))!;
  assert.equal(b.payment.advanceReceived, paid);
  assert.equal(b.payment.balanceDue, pricing1.total - paid);
  const quotationBefore = structuredClone((await s.getQuotation(draft.quotation.quotationId))!);
  const paymentsBefore = structuredClone(await s.listPaymentsForBooking(id));

  // 9. change every pricing input
  const c2 = changedConfig(c1);
  await saveConfig(c2);

  // 10–11. booking quote unchanged
  b = (await s.getBooking(id))!;
  assert.deepEqual(b.pricing, pricing1);
  assert.equal(b.payment.advanceRequired, pricing1.advanceRequired);
  assert.equal(b.payment.advanceReceived, paid);
  assert.equal(b.payment.balanceDue, pricing1.total - paid);
  // 12–13. quotation unchanged
  assert.deepEqual(await s.getQuotation(draft.quotation.quotationId), quotationBefore);
  // 14–15. payments and receipts unchanged
  assert.deepEqual(await s.listPaymentsForBooking(id), paymentsBefore);

  // 16–17. a new booking uses the new configuration
  const other = await createCustomerBookingRequest(s, { uid: "c2", email: null }, input({ ...bookingInput, date: "2026-10-25", requestKey: randomUUID() } as never), { now: NOW, config: c2 });
  assert.ok(other.ok, JSON.stringify(other));
  assert.notEqual(other.booking.pricing?.total, pricing1.total);
  assert.equal(other.booking.pricing?.advanceRequired, 70_000);
  assert.ok(other.booking.pricing?.lines.some((l) => l.code === "hall_rent" && l.amount === 175_000));
  return { id, total1: pricing1.total, total2: other.booking.pricing!.total };
}
