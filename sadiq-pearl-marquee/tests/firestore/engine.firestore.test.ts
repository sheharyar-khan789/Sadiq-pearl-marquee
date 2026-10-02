// The same booking-engine scenarios, run against the REAL Firestore adapter
// (src/lib/booking/firestore-store.ts) on the Firestore EMULATOR — never a
// real project. Requires firebase-tools + Java 21:
//
//   npm run test:booking:firestore
//
// Without FIRESTORE_EMULATOR_HOST this file refuses to run (it never falls
// back to a real database).
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { firestoreBookingStore } from "../../src/lib/booking/firestore-store.ts";
import { defineEngineScenarios } from "../booking/engine-scenarios.ts";

const projectId = "demo-sadiq-pearl";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is not set; refusing to run against a real Firestore.");

const db = getFirestore(initializeApp({ projectId }, "booking-engine-test"));

defineEngineScenarios("firestore emulator", async () => {
  // Start every scenario from an empty emulator database.
  const res = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Could not reset the emulator (${res.status})`);
  return firestoreBookingStore(db);
});
