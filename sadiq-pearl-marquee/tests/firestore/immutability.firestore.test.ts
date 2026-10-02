// Historical financial immutability on the Firestore EMULATOR (never a real
// project): the 17-step scenario in tests/booking/immutability-scenario.ts,
// with the configuration stored in businessConfig/main.
// Refuses to run without FIRESTORE_EMULATOR_HOST. Run: npm run test:booking:firestore
import { beforeEach, describe, it } from "node:test";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import type { BookingStore } from "../../src/lib/booking/store.ts";
import { immutabilityScenario } from "../booking/immutability-scenario.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");
const db = getFirestore(initializeApp({ projectId }, "immutability-test"));
let s: BookingStore;

beforeEach(async () => {
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  s = firestoreBookingStore(db);
});

describe("firestore emulator: historical financial immutability", () => {
  it("17-step scenario: configuration changes never rewrite old financial records", async () => {
    await immutabilityScenario(s, async (config) => {
      await db.collection("businessConfig").doc("main").set(config);
    });
  });
});
