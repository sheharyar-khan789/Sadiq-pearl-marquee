// Business configuration loading — SERVER ONLY.
//  - loadConfigFresh(): always reads the stored document (admin pages, booking
//    creation, approvals), so prices and rules are the current ones.
//  - loadPublicConfig(): the same data restricted to active records, cached
//    in-process for 30 s (public pages and the availability API). It holds no
//    user-specific or secret data, and is cleared whenever an admin saves.
// If the database can't be read, callers get { ok: false } and must fail
// closed (no booking on guessed rules); they never silently fall back.
import "server-only";
import { cache } from "react";
import { logBookingError, bookingStore, withTimeout } from "../booking/server";
import { DEFAULT_CONFIG, normalizeConfig, toPublicConfig, type BusinessConfig } from "./business-config";

export type ConfigResult = { ok: true; config: BusinessConfig; stored: boolean } | { ok: false; reason: "unavailable" | "error" };

const PUBLIC_TTL_MS = 30_000;
// On globalThis: Next.js bundles pages and route handlers separately, and a
// module-level cache would exist once per bundle (a save in the settings API
// would not clear the copy used by /book). Other server instances refresh
// within PUBLIC_TTL_MS.
const g = globalThis as typeof globalThis & { __sadiqPearlPublicConfig?: { at: number; config: BusinessConfig } | null };

/** Called after every successful configuration change in this process. */
export function invalidatePublicConfig() {
  g.__sadiqPearlPublicConfig = null;
}

/** Current configuration, read from the database (deduplicated per request). */
export const loadConfigFresh = cache(async (): Promise<ConfigResult> => {
  const store = bookingStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    const stored = await withTimeout(store.getConfig(), 10_000);
    return { ok: true, config: stored ? normalizeConfig(stored) : DEFAULT_CONFIG, stored: stored !== null };
  } catch (error) {
    logBookingError("config load", error);
    return { ok: false, reason: "error" };
  }
});

/** Public (active-only) configuration with a short in-process cache. */
export async function loadPublicConfig(): Promise<ConfigResult> {
  const cached = g.__sadiqPearlPublicConfig;
  if (cached && Date.now() - cached.at < PUBLIC_TTL_MS) return { ok: true, config: cached.config, stored: true };
  const fresh = await loadConfigFresh();
  if (!fresh.ok) return fresh;
  const config = toPublicConfig(fresh.config);
  g.__sadiqPearlPublicConfig = { at: Date.now(), config };
  return { ok: true, config, stored: fresh.stored };
}
