// Historical financial immutability — IN-MEMORY store (not Firestore).
// The same scenario runs on the Firestore emulator in
// tests/firestore/immutability.firestore.test.ts. Run: npm run test:booking
import { describe, it } from "node:test";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";
import { immutabilityScenario } from "./immutability-scenario.ts";

describe("historical financial immutability (in-memory)", () => {
  it("changing hall rent, guest rate, service/menu/package prices, discount, service charge, surcharge and advance never alters old quotes, quotations, payments or receipts", async () => {
    const s = new MemoryBookingStore();
    await immutabilityScenario(s, async (config) => s.seed({ config }));
  });
});
