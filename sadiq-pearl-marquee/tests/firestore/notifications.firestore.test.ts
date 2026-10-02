// Phase 9 notifications against the REAL Firestore adapter on the Firestore
// EMULATOR (never a real project). Also exercises the composite index
// notifications (customerId ASC, createdAt DESC) and the unread count query.
// Refuses to run without FIRESTORE_EMULATOR_HOST. Run: npm run test:booking:firestore
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { notificationScenario } from "../booking/notifications-scenario.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "notifications-test"));
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

describe("firestore emulator: notifications", () => {
  it("lifecycle: created in the same transaction as each change, once; ownership; read state", async () => {
    await notificationScenario(s);
  });
});
