// Official venue policies (policy card): the single terms source, the card's
// pricing rules applied by the ONE pricing engine (quote()), and the terms
// copied into new quotations (old quotations unchanged).
// IN-MEMORY transactional store (not Firestore). Run: npm run test:booking
// Base prices below are TEST FIXTURES; the card itself has no hall rent or per-guest rate.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PDFDocument } from "pdf-lib";
import { OFFICIAL_VENUE_TERMS } from "../../src/data/policies.ts";
import { terms as menuTerms } from "../../src/data/menu.ts";
import { quotationPdf } from "../../src/lib/booking/documents-pdf.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { generateQuotation } from "../../src/lib/booking/finance.ts";
import type { BusinessSnapshot } from "../../src/lib/booking/finance-model.ts";
import { quote } from "../../src/lib/booking/pricing.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { DEFAULT_CONFIG, type BusinessConfig } from "../../src/lib/config/business-config.ts";
import { input, NOW } from "./engine-scenarios.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const BUSINESS: BusinessSnapshot = { name: "Test Venue", address: "Test address", phones: ["0300 0000000"] };
/** The DEFAULT pricing rules (from the card) + test base prices so quote() can price. */
const CARD_RULES: BusinessConfig = {
  ...structuredClone(DEFAULT_CONFIG),
  pricing: { ...DEFAULT_CONFIG.pricing, hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000 },
};
const req = (guestCount: number) => ({ hallId: "main-hall", guestCount, serviceIds: [], menuId: null, packageId: null });

describe("official venue terms", () => {
  it("one source: the public terms sheet re-exports the same list; the card's key policies are present", () => {
    assert.equal(menuTerms, OFFICIAL_VENUE_TERMS);
    const text = OFFICIAL_VENUE_TERMS.map((t) => `${t.title} ${t.body}`).join(" ");
    for (const must of [
      "minimum of 300 guests",
      "extra Rs. 300 per head",
      "Rs. 20,000 for one hour",
      "5% service charges",
      "responsible for keeping your valuables safe",
      "Fireworks and firing are strictly prohibited",
      "advance amount is non-refundable",
    ]) {
      assert.ok(text.includes(must), must);
    }
  });

  it("the card's pricing rules are the configuration defaults (no advance amount, no tax rate invented)", () => {
    assert.deepEqual(DEFAULT_CONFIG.pricing.smallEventSurcharge, { belowGuests: 300, perGuest: 300 });
    assert.equal(DEFAULT_CONFIG.pricing.serviceChargePercent, 5);
    assert.equal(DEFAULT_CONFIG.pricing.advance, null);
    assert.equal(DEFAULT_CONFIG.pricing.hallRent["main-hall"], null, "no base price invented");
    assert.equal(DEFAULT_CONFIG.pricing.perGuestRate, null, "no base price invented");
    assert.equal(quote(DEFAULT_CONFIG, req(250), NOW).status, "unpriced", "without base prices: Pricing pending");
  });
});

describe("card pricing through quote()", () => {
  it("below 300 guests: + Rs 300 per guest; then 5% service charge", () => {
    const q = quote(CARD_RULES, req(250), NOW);
    assert.equal(q.status, "priced");
    if (q.status !== "priced") return;
    const surcharge = q.snapshot.lines.find((l) => l.code === "small_event_surcharge");
    assert.deepEqual([surcharge?.quantity, surcharge?.unitAmount, surcharge?.amount], [250, 300, 75_000]);
    assert.equal(q.snapshot.subtotal, 100_000 + 250 * 1_000 + 75_000);
    assert.equal(q.snapshot.serviceCharge, Math.round((425_000 * 5) / 100));
    assert.equal(q.snapshot.total, 425_000 + 21_250);
  });

  it("300 guests or more: no guest surcharge (5% service charge still applies)", () => {
    for (const guests of [300, 450]) {
      const q = quote(CARD_RULES, req(guests), NOW);
      assert.ok(q.status === "priced");
      if (q.status !== "priced") return;
      assert.equal(q.snapshot.lines.some((l) => l.code === "small_event_surcharge"), false, String(guests));
      assert.equal(q.snapshot.serviceCharge, Math.round((q.snapshot.subtotal * 5) / 100));
    }
  });
});

describe("terms in quotations", () => {
  it("a NEW quotation carries a copy of the official terms and its PDF renders; an older one without terms still renders", async () => {
    const s = new MemoryBookingStore();
    const r = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ date: "2026-10-15", guestCount: 250 }), { now: NOW, config: CARD_RULES });
    assert.ok(r.ok, JSON.stringify(r));
    const g = await generateQuotation(s, ADMIN, r.booking.bookingId, { now: NOW, config: CARD_RULES, business: BUSINESS });
    assert.ok(g.ok, JSON.stringify(g));
    const snap = g.quotation.snapshot;
    assert.deepEqual(snap.terms, OFFICIAL_VENUE_TERMS);
    assert.notEqual(snap.terms, OFFICIAL_VENUE_TERMS, "a copy, not a live reference");
    const withTerms = await PDFDocument.load(await quotationPdf(g.quotation, null));
    const { terms: _old, ...legacy } = snap;
    void _old;
    const without = await PDFDocument.load(await quotationPdf({ ...g.quotation, snapshot: legacy }, null));
    assert.ok(withTerms.getPageCount() >= without.getPageCount() && without.getPageCount() >= 1);
  });
});
