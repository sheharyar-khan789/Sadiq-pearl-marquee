// Guest reviews (Phase 10): validation, eligibility (own + completed booking),
// one review per booking, edits return to moderation, Super Admin moderation,
// approved-only public view, aggregates from approved reviews only, audit.
// IN-MEMORY transactional store (not Firestore). Run: npm run test:booking
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { moderateReview, reviewAggregate, reviewIdFor, submitReview, toPublicReview, validateReviewInput } from "../../src/lib/booking/reviews.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { input, NOW } from "./engine-scenarios.ts";
import { testConfig } from "./test-config.ts";

const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const PRICES = testConfig({ hallRent: { "main-hall": 100_000 }, perGuestRate: 1_000 });
const good = { rating: 5, text: "Lovely venue and very helpful staff.", displayName: "Ayesha K." };

async function booking(s: MemoryBookingStore, uid: string, opts: { date?: string; complete?: boolean } = {}) {
  const r = await createCustomerBookingRequest(s, { uid, email: null }, input({ date: opts.date ?? "2026-10-01" }), { now: NOW, config: PRICES });
  assert.ok(r.ok, JSON.stringify(r));
  assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, "confirmed", { now: NOW })).ok);
  // "Completed" is only possible after the event date: mark it the day after.
  const after = new Date(`${opts.date ?? "2026-10-01"}T12:00:00Z`);
  after.setUTCDate(after.getUTCDate() + 1);
  if (opts.complete !== false) assert.ok((await adminSetStatus(s, ADMIN, r.booking.bookingId, "completed", { now: after })).ok);
  return r.booking.bookingId;
}

describe("review validation", () => {
  it("accepts a valid review; refuses bad rating, text, name and unknown fields", () => {
    assert.ok(validateReviewInput(good).ok);
    for (const [over, field] of [
      [{ rating: 0 }, "rating"],
      [{ rating: 6 }, "rating"],
      [{ rating: 4.5 }, "rating"],
      [{ rating: "5" }, "rating"],
      [{ text: "short" }, "text"],
      [{ text: "x".repeat(1001) }, "text"],
      [{ displayName: "A" }, "displayName"],
      [{ status: "approved" }, "body"],
      [{ customerId: "someone" }, "body"],
      [{ bookingId: "bk_x" }, "body"],
    ] as const) {
      const r = validateReviewInput({ ...good, ...over });
      assert.equal(r.ok, false, JSON.stringify(over));
      assert.ok(!r.ok && field in r.errors, `${field}`);
    }
  });
});

describe("review submission", () => {
  it("only the owner of a COMPLETED booking can review it; one review per booking", async () => {
    const s = new MemoryBookingStore();
    const done = await booking(s, "c1");
    const upcoming = await booking(s, "c1", { date: "2026-10-20", complete: false });
    assert.deepEqual(await submitReview(s, "c2", done, good, { now: NOW }), { ok: false, code: "not_found" }, "another customer's booking");
    assert.deepEqual(await submitReview(s, "c1", upcoming, good, { now: NOW }), { ok: false, code: "not_completed" });
    assert.deepEqual(await submitReview(s, "c1", "bk_000000000000000000000000", good, { now: NOW }), { ok: false, code: "not_found" });
    const r = await submitReview(s, "c1", done, good, { now: NOW });
    assert.ok(r.ok && r.created);
    assert.equal(r.review.status, "pending", "never public automatically");
    assert.equal(r.review.reviewId, reviewIdFor(done));
    assert.equal(r.review.customerId, "c1");
    // A second submission edits the same review (no duplicate).
    const again = await submitReview(s, "c1", done, { ...good, rating: 4 }, { now: NOW });
    assert.ok(again.ok && !again.created);
    assert.equal(s.reviewCount(), 1);
    assert.deepEqual(await submitReview(s, "c1", done, { ...good, rating: 4 }, { now: NOW }), { ok: false, code: "no_change" });
  });
});

describe("moderation", () => {
  it("Super Admin approves / rejects (audited, no review text in the audit); edits return to moderation", async () => {
    const s = new MemoryBookingStore();
    const id = await booking(s, "c1");
    const r = await submitReview(s, "c1", id, good, { now: NOW });
    assert.ok(r.ok);
    assert.deepEqual(await moderateReview(s, ADMIN, r.review.reviewId, "publish", { now: NOW }), { ok: false, code: "invalid_decision" });
    assert.deepEqual(await moderateReview(s, ADMIN, r.review.reviewId, "approve", { now: NOW, expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }), { ok: false, code: "stale" });
    const ap = await moderateReview(s, ADMIN, r.review.reviewId, "approve", { now: NOW, note: "INTERNAL NOTE" });
    assert.ok(ap.ok);
    assert.equal(ap.review.status, "approved");
    assert.deepEqual(await moderateReview(s, ADMIN, r.review.reviewId, "approve", { now: NOW }), { ok: false, code: "already_decided" });
    const audit = (await s.listAuditForBooking(id, 20)).find((a) => a.action === "review_approved")!;
    assert.ok(audit && audit.entityId === r.review.reviewId);
    assert.ok(!JSON.stringify(audit).includes("Lovely venue"), "no review text in the audit trail");
    // The customer edits an approved review: it leaves the public list until re-approved.
    const edited = await submitReview(s, "c1", id, { ...good, text: "Lovely venue, staff were helpful throughout." }, { now: NOW });
    assert.ok(edited.ok);
    assert.equal(edited.review.status, "pending");
    assert.equal(edited.review.revision, 1);
    assert.equal((await s.listReviewsByStatus("approved", 50)).length, 0);
    assert.ok((await moderateReview(s, ADMIN, r.review.reviewId, "reject", { now: NOW })).ok);
    assert.equal((await s.getReview(r.review.reviewId))!.status, "rejected");
  });
});

describe("public view and aggregates", () => {
  it("public view carries no customer id, booking id or internal note; aggregates use approved reviews only", async () => {
    const s = new MemoryBookingStore();
    const ratings = [5, 4, 4, 2];
    for (let i = 0; i < ratings.length; i++) {
      const id = await booking(s, `guest-uid-${i}`, { date: `2026-10-${String(10 + i)}` });
      const r = await submitReview(s, `guest-uid-${i}`, id, { ...good, rating: ratings[i] }, { now: NOW });
      assert.ok(r.ok);
      if (i < 3) assert.ok((await moderateReview(s, ADMIN, r.review.reviewId, "approve", { now: NOW, note: "NOTE" })).ok);
    }
    const approved = await s.listReviewsByStatus("approved", 50);
    assert.equal(approved.length, 3);
    const view = JSON.stringify(approved.map(toPublicReview));
    // The uids contain non-hex letters, so the random reviewId hash can never contain them by chance.
    for (const leak of ["guest-uid", "bk_", "NOTE", "customerId", "moderation"]) assert.ok(!view.includes(leak), leak);
    const all = [...approved, ...(await s.listReviewsByStatus("pending", 50))];
    assert.deepEqual(reviewAggregate(all), {
      count: 3,
      average: 4.3,
      distribution: [{ stars: 1, count: 0 }, { stars: 2, count: 0 }, { stars: 3, count: 0 }, { stars: 4, count: 2 }, { stars: 5, count: 1 }],
    });
    assert.deepEqual(reviewAggregate([]), { count: 0, average: null, distribution: [1, 2, 3, 4, 5].map((stars) => ({ stars, count: 0 })) });
  });
});
