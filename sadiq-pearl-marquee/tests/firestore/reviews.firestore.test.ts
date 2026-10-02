// Phase 10 guest reviews against the REAL Firestore adapter on the Firestore
// EMULATOR (never a real project). Refuses to run without FIRESTORE_EMULATOR_HOST.
// Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { adminSetStatus } from "../../src/lib/booking/admin.ts";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import { moderateReview, reviewAggregate, submitReview } from "../../src/lib/booking/reviews.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { input, NOW } from "../booking/engine-scenarios.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "reviews-test"));
let s: BookingStore;
const ADMIN = { uid: "admin-1", email: "admin@example.test" };

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

describe("firestore emulator: guest reviews", () => {
  it("owner of a completed booking submits; pending is not public; admin approves; edits return to moderation", async () => {
    const r = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ date: "2026-10-01" }), { now: NOW });
    assert.ok(r.ok);
    const id = r.booking.bookingId;
    assert.ok((await adminSetStatus(s, ADMIN, id, "confirmed", { now: NOW })).ok);
    assert.ok((await adminSetStatus(s, ADMIN, id, "completed", { now: new Date("2026-10-02T06:00:00Z") })).ok);
    const review = { rating: 5, text: "Lovely venue and very helpful staff.", displayName: "Ayesha K." };
    assert.deepEqual(await submitReview(s, "c2", id, review, { now: NOW }), { ok: false, code: "not_found" });
    const sub = await submitReview(s, "c1", id, review, { now: NOW });
    assert.ok(sub.ok && sub.review.status === "pending");
    assert.equal((await s.listReviewsByStatus("approved", 50)).length, 0);
    assert.ok((await moderateReview(s, ADMIN, sub.review.reviewId, "approve", { now: NOW })).ok);
    const approved = await s.listReviewsByStatus("approved", 50);
    assert.deepEqual(reviewAggregate(approved).count, 1);
    const edit = await submitReview(s, "c1", id, { ...review, rating: 4 }, { now: NOW });
    assert.ok(edit.ok && edit.review.status === "pending");
    assert.equal((await s.listReviewsByStatus("approved", 50)).length, 0);
  });
});
