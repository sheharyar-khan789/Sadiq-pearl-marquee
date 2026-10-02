// Booking-engine scenarios against the in-memory transactional store.
// Run: npm run test:booking
import assert from "node:assert/strict";
import { it } from "node:test";
import { createCustomerBookingRequest } from "../../src/lib/booking/engine.ts";
import { defineEngineScenarios, input, NOW } from "./engine-scenarios.ts";
import { MemoryBookingStore } from "../../src/lib/booking/testing/memory-store.ts";

defineEngineScenarios("memory store", async () => new MemoryBookingStore());

it("memory store: racing requests really conflict and are retried (not serialised by accident)", async () => {
  const store = new MemoryBookingStore();
  const results = await Promise.all(
    [1, 2].map((n) => createCustomerBookingRequest(store, { uid: `race-${n}`, email: null }, input(), { now: NOW }))
  );
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.ok(store.retries >= 1, "expected at least one transaction retry from contention");
  assert.equal(store.bookingCount(), 1);
  assert.equal(store.lockCount(), 1);
});
