// Phase 8 event operations against the REAL Firestore adapter on the Firestore
// EMULATOR (never a real project). Refuses to run without FIRESTORE_EMULATOR_HOST.
// Run: npm run test:booking:firestore
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import { addOpsNote, assignVendor } from "../../src/lib/booking/operations.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { NOW } from "../booking/engine-scenarios.ts";
import { ADMIN, confirmedBooking, LABELS, operationsScenario, testVendor, twoHallConfig } from "../booking/operations-scenario.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "operations-test"));
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

describe("firestore emulator: event operations", () => {
  it("full scenario: status, checklist, notes, vendor clash, booking move, cancellation, unassign — financial data untouched", async () => {
    await operationsScenario(s);
  });

  it("first operational change by two admins at once creates ONE record with both changes", async () => {
    const id = await confirmedBooking(s, twoHallConfig(), "c1", {});
    const [x, y] = await Promise.all([
      addOpsNote(s, ADMIN, id, "first", { now: NOW, labels: LABELS }),
      addOpsNote(s, { uid: "admin-2", email: "a2@example.test" }, id, "second", { now: NOW, labels: LABELS }),
    ]);
    assert.ok(x.ok && y.ok);
    assert.deepEqual((await s.getOperations(id))!.notes.map((n) => n.text).sort(), ["first", "second"]);
  });

  it("two admins assigning one vendor to clashing events at once: exactly one succeeds", async () => {
    const config = twoHallConfig();
    const a = await confirmedBooking(s, config, "c1", { date: "2026-10-20" });
    const b = await confirmedBooking(s, config, "c2", { date: "2026-10-20", hallId: "test-hall-2" });
    const vendor = await testVendor(s, "Studio X");
    const results = await Promise.all([
      assignVendor(s, ADMIN, a, { vendorId: vendor, category: "photographer" }, { now: NOW }),
      assignVendor(s, { uid: "admin-2", email: "a2@example.test" }, b, { vendorId: vendor, category: "photographer" }, { now: NOW }),
    ]);
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
  });
});
