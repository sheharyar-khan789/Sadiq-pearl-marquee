// Customer-portal data loading for server components — SERVER ONLY.
// The uid always comes from requireUser() (verified session cookie).
import "server-only";
import { cache } from "react";
import { anyLabel, slotLabel, type BusinessConfig } from "./catalog";
import { toPublicConfig } from "../config/business-config";
import { loadConfigFresh } from "../config/config-server";
import { businessToday } from "./dates";
import { getOwnBooking, listOwnBookings, listOwnRequests } from "./customer";
import { toCustomerView, toRequestView, type CustomerBookingView, type CustomerRequestView } from "./portal";
import { bookingStore, logBookingError, withTimeout } from "./server";
import { toCustomerPaymentView, toCustomerQuotationViews, type CustomerPaymentView, type QuotationView } from "./finance-view";

export type PortalResult<T> = { ok: true; data: T } | { ok: false; reason: "unavailable" | "error" };

const TIMEOUT_MS = 10_000;
/** Labels from the configuration (inactive records included, for older requests). */
const labelsFor = (config: BusinessConfig) => ({
  slot: (id: string) => slotLabel(config, id),
  menu: (id: string) => anyLabel(config, "menu", id),
  service: (id: string) => anyLabel(config, "service", id),
});

/** Configuration for reading pages; throws (→ error state) if it can't be loaded. */
async function configOrThrow(): Promise<BusinessConfig> {
  const r = await loadConfigFresh();
  if (!r.ok) throw Object.assign(new Error("config unavailable"), { code: `config_${r.reason}` });
  return r.config;
}

export interface PortalOverview {
  today: string;
  bookings: CustomerBookingView[];
  /** bookingId -> open request types, for "change requested" badges. */
  openRequests: Record<string, string[]>;
}

/** All of one customer's bookings (+ their open requests). Deduplicated per request. */
export const loadCustomerOverview = cache(async (uid: string): Promise<PortalResult<PortalOverview>> => {
  const store = bookingStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    const now = new Date();
    const [bookings, open] = await withTimeout(
      Promise.all([listOwnBookings(store, uid), listOwnRequests(store, uid, { openOnly: true })]),
      TIMEOUT_MS
    );
    const openRequests: Record<string, string[]> = {};
    for (const r of open) (openRequests[r.bookingId] ??= []).push(r.type);
    return {
      ok: true,
      data: { today: businessToday(now), bookings: bookings.map((b) => toCustomerView(b, now)), openRequests },
    };
  } catch (error) {
    logBookingError("customer overview", error);
    return { ok: false, reason: "error" };
  }
});

export interface BookingDetail {
  today: string;
  booking: CustomerBookingView;
  requests: CustomerRequestView[];
  /** Public configuration (current options and policies; never rewrites the booking). */
  config: BusinessConfig;
  /** Phase 7: this booking's payments (receipts) and issued quotations, newest first. */
  payments: CustomerPaymentView[];
  quotations: QuotationView[];
}

/** One booking, only if it belongs to `uid`; null when missing or not theirs. */
export async function loadCustomerBooking(uid: string, bookingId: string): Promise<PortalResult<BookingDetail | null>> {
  const store = bookingStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    const now = new Date();
    const booking = await withTimeout(getOwnBooking(store, uid, bookingId), TIMEOUT_MS);
    if (!booking) return { ok: true, data: null };
    const [requests, config, payments, quotations] = await Promise.all([
      withTimeout(listOwnRequests(store, uid, { bookingId }), TIMEOUT_MS),
      configOrThrow(),
      // Read only after the ownership check above; filtered to this customer again.
      withTimeout(store.listPaymentsForBooking(bookingId), TIMEOUT_MS),
      withTimeout(store.listQuotationsForBooking(bookingId), TIMEOUT_MS),
    ]);
    const labels = labelsFor(config);
    return {
      ok: true,
      data: {
        today: businessToday(now),
        booking: toCustomerView(booking, now),
        requests: requests.map((r) => toRequestView(r, labels)),
        config: toPublicConfig(config),
        payments: payments
          .filter((p) => p.customerId === uid)
          .map(toCustomerPaymentView)
          .reverse(),
        quotations: toCustomerQuotationViews(
          quotations.filter((q) => q.customerId === uid),
          booking
        ),
      },
    };
  } catch (error) {
    logBookingError("customer booking", error);
    return { ok: false, reason: "error" };
  }
}
