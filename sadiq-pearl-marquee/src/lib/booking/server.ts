// Server wiring for the booking engine and customer portal — SERVER ONLY.
import "server-only";
import { readFileSync } from "node:fs";
import { firestoreProfileStore } from "@/lib/account/firestore-profile-store";
import { MemoryProfileStore, type ProfileStore } from "@/lib/account/profile";
import { adminFirestore, isAdminConfigured } from "@/lib/firebase/admin";
import { firestoreBookingStore } from "./firestore-store";
import type { BookingStore } from "./store";
import { MemoryBookingStore } from "./testing/memory-store";

/**
 * LOCAL E2E TEST MODE ONLY. The Firestore emulator cannot run on the
 * development machine used so far, so browser tests of the customer portal
 * can opt into the in-memory test store. It switches on only when ALL hold:
 *   - SADIQ_PEARL_E2E_MEMORY_STORE=1
 *   - FIREBASE_AUTH_EMULATOR_HOST is set (sessions come from the Auth emulator)
 *   - the project ID starts with "demo-" (Firebase's emulator-only projects)
 *   - no real Admin credentials are configured
 * A real deployment meets none of these, so it always uses Firestore.
 */
function e2eMemoryMode(): boolean {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  return (
    process.env.SADIQ_PEARL_E2E_MEMORY_STORE === "1" &&
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) &&
    projectId.startsWith("demo-") &&
    !process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
    !process.env.K_SERVICE
  );
}

let store: BookingStore | null = null;
let profiles: ProfileStore | null = null;

// Next.js bundles route handlers and pages separately, so a module-level test
// store would exist once per bundle. The E2E test stores live on globalThis so
// every route sees the same data (production Firestore is unaffected).
const e2e = globalThis as typeof globalThis & {
  __sadiqPearlE2E?: { bookings: MemoryBookingStore; profiles: MemoryProfileStore };
};
function e2eStores() {
  return (e2e.__sadiqPearlE2E ??= { bookings: memoryStore(), profiles: memoryProfiles() });
}

/** ISO date-time strings in the seed file become Dates (plain YYYY-MM-DD stays a string). */
function reviveSeed(_key: string, value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) ? new Date(value) : value;
}

function memoryProfiles(): MemoryProfileStore {
  const memory = new MemoryProfileStore();
  const seedPath = process.env.SADIQ_PEARL_E2E_SEED;
  if (seedPath) memory.seed(JSON.parse(readFileSync(seedPath, "utf8")).profiles ?? []);
  return memory;
}

function memoryStore(): MemoryBookingStore {
  const memory = new MemoryBookingStore();
  const seedPath = process.env.SADIQ_PEARL_E2E_SEED;
  if (seedPath) memory.seed(JSON.parse(readFileSync(seedPath, "utf8"), reviveSeed));
  console.warn("[booking] LOCAL E2E TEST MODE: using the in-memory test store (not Firestore).");
  return memory;
}

/** The booking store, or null when server credentials are missing. */
export function bookingStore(): BookingStore | null {
  if (e2eMemoryMode()) return e2eStores().bookings;
  if (!isAdminConfigured()) return null;
  store ??= firestoreBookingStore(adminFirestore());
  return store;
}

/** The customer-profile store, or null when server credentials are missing. */
export function profileStore(): ProfileStore | null {
  if (e2eMemoryMode()) return e2eStores().profiles;
  if (!isAdminConfigured()) return null;
  profiles ??= firestoreProfileStore(adminFirestore());
  return profiles;
}

export class TimeoutError extends Error {
  constructor() {
    super("Timed out");
    this.name = "TimeoutError";
  }
}

/** Stops a request from hanging when the database cannot be reached. */
export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Logs only an error's code/name, never its message or data. */
export function logBookingError(context: string, error: unknown) {
  const e = error as { code?: unknown; name?: unknown };
  const code = typeof e?.code === "string" || typeof e?.code === "number" ? e.code : e?.name ?? "unknown";
  console.error(`[booking] ${context} failed: ${String(code)}`);
}
