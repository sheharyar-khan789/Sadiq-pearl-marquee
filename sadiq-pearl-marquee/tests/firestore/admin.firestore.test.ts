// Phase 5 admin concurrency scenarios against the REAL Firestore adapter on
// the Firestore EMULATOR (never a real project). Refuses to run without
// FIRESTORE_EMULATOR_HOST. Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { adminSetStatus, decideRequest } from "../../src/lib/booking/admin.ts";
import { submitChangeRequest, validateChangeRequest } from "../../src/lib/booking/customer.ts";
import { createCustomerBookingRequest, createManualBooking } from "../../src/lib/booking/engine.ts";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { input, NOW } from "../booking/engine-scenarios.ts";
import { DEFAULT_CONFIG } from "../../src/lib/config/business-config.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "admin-concurrency-test"));
const ADMIN = { uid: "admin-1", email: "admin@example.test" };
const ADMIN2 = { uid: "admin-2", email: "admin2@example.test" };
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

const locks = () => s.listLocks("main-hall", "2026-01-01", "2027-12-31");
async function modify(uid: string, bookingId: string, changes: object) {
  const v = validateChangeRequest({ type: "modification", changes, requestKey: randomUUID() }, "2026-10-01", DEFAULT_CONFIG);
  assert.ok(v.ok);
  const r = await submitChangeRequest(s, { uid }, bookingId, v.value, { now: NOW });
  assert.ok(r.ok);
  return r.request;
}

describe("firestore emulator: admin concurrency", () => {
  it("modification race: two approvals for the same new slot — exactly one succeeds", async () => {
    const a = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input({ date: "2026-10-20" }), { now: NOW });
    const b = await createCustomerBookingRequest(s, { uid: "c2", email: null }, input({ date: "2026-10-21" }), { now: NOW });
    assert.ok(a.ok && b.ok);
    const ra = await modify("c1", a.booking.bookingId, { eventDate: "2026-10-30" });
    const rb = await modify("c2", b.booking.bookingId, { eventDate: "2026-10-30" });
    const results = await Promise.all([
      decideRequest(s, ADMIN, ra.requestId, "approve", { now: NOW }),
      decideRequest(s, ADMIN2, rb.requestId, "approve", { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await locks()).length, 2);
  });

  it("manual vs website booking for the same slot — exactly one succeeds", async () => {
    const results = await Promise.all([
      createManualBooking(s, ADMIN, { ...input(), source: "walk_in", status: "confirmed", customerId: null, email: null }, { now: NOW }),
      createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await locks()).length, 1);
  });

  it("two admins confirming the same booking — exactly one", async () => {
    const a = await createCustomerBookingRequest(s, { uid: "c1", email: null }, input(), { now: NOW });
    assert.ok(a.ok);
    const results = await Promise.all([
      adminSetStatus(s, ADMIN, a.booking.bookingId, "confirmed", { now: NOW }),
      adminSetStatus(s, ADMIN2, a.booking.bookingId, "confirmed", { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal((await s.listAuditForBooking(a.booking.bookingId, 10)).length, 1);
  });
});
