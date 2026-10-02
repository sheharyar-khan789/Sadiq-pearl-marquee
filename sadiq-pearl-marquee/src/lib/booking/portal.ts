// Customer-portal read model (Phase 4). Turns stored bookings into what a
// customer may see. Pure functions; safe for server and client code.
//
// A view never contains staff-only fields (adminNotes, createdBy), the slot
// lock key, or the customer's uid, so it can be passed to client components.
import type { SlotId } from "./catalog.ts";
import { bookingReference, type BookingRecord, type BookingTimeline } from "./model.ts";
import type { PriceLine } from "./pricing.ts";
import { REQUEST_STATUS_LABELS, type BookingRequestRecord, type BookingRequestType } from "./request-model.ts";
import { STATUS_LABELS, type BookingStatus } from "./status.ts";

export interface CustomerBookingView {
  bookingId: string;
  reference: string;
  eventDate: string;
  hallName: string;
  slotId: SlotId;
  slotLabel: string;
  eventTypeLabel: string;
  guestCount: number;
  services: { id: string; label: string }[];
  menuPreference: { id: string; title: string } | null;
  /** Package snapshot stored on the booking (Phase 6). */
  package: { id: string; name: string } | null;
  customerNotes: string;
  contact: { name: string; phone: string };
  status: BookingStatus;
  statusLabel: string;
  /** A pending request whose temporary slot hold has run out (still awaiting review). */
  holdLapsed: boolean;
  pricing: {
    lines: PriceLine[];
    subtotal: number;
    discount: number;
    discountLabel: string;
    serviceCharge: number;
    total: number;
    configVersion: string;
  } | null;
  payment: { advanceRequired: number | null; advanceReceived: number; balanceDue: number | null };
  timeline: { key: keyof BookingTimeline; label: string; at: string }[];
  createdAt: string;
}

export interface CustomerRequestView {
  requestId: string;
  bookingId: string;
  type: BookingRequestType;
  status: BookingRequestRecord["status"];
  statusLabel: string;
  summary: string[];
  requestedSlotState: string | null;
  reason: string;
  createdAt: string;
}

const TIMELINE_LABELS: Record<keyof BookingTimeline, string> = {
  submittedAt: "Request submitted",
  reviewedAt: "Under review",
  confirmedAt: "Booking confirmed",
  completedAt: "Event completed",
  cancelledAt: "Booking cancelled",
  rejectedAt: "Request not accepted",
  expiredAt: "Request expired",
};

const iso = (d: Date | string) => new Date(d).toISOString();

export function toCustomerView(b: BookingRecord, now: Date): CustomerBookingView {
  const timeline = (Object.keys(TIMELINE_LABELS) as (keyof BookingTimeline)[])
    .filter((key) => b.timeline?.[key])
    .map((key) => ({ key, label: TIMELINE_LABELS[key], at: iso(b.timeline[key] as Date) }))
    .sort((x, y) => x.at.localeCompare(y.at));

  return {
    bookingId: b.bookingId,
    reference: bookingReference(b.bookingId),
    eventDate: b.eventDate,
    hallName: b.hallName,
    slotId: b.slotId,
    slotLabel: b.slotLabel,
    eventTypeLabel: b.eventTypeLabel,
    guestCount: b.guestCount,
    services: b.services ?? [],
    menuPreference: b.menuPreference ?? null,
    package: b.package ? { id: b.package.id, name: b.package.name } : null,
    customerNotes: b.customerNotes ?? "",
    contact: { name: b.customer?.name ?? "", phone: b.customer?.phone ?? "" },
    status: b.status,
    statusLabel: STATUS_LABELS[b.status] ?? b.status,
    holdLapsed:
      b.status === "pending" && b.holdExpiresAt !== null && new Date(b.holdExpiresAt).getTime() <= now.getTime(),
    pricing: b.pricing
      ? {
          lines: b.pricing.lines,
          subtotal: b.pricing.subtotal,
          discount: b.pricing.discount ?? 0,
          discountLabel: b.pricing.discountLabel ?? "Discount",
          serviceCharge: b.pricing.serviceCharge,
          total: b.pricing.total,
          configVersion: b.pricing.configVersion,
        }
      : null,
    payment: {
      advanceRequired: b.payment?.advanceRequired ?? null,
      advanceReceived: b.payment?.advanceReceived ?? 0,
      balanceDue: b.payment?.balanceDue ?? null,
    },
    timeline,
    createdAt: iso(b.createdAt),
  };
}

/** Statuses of a booking that is still going ahead or awaiting a decision. */
const ACTIVE: readonly BookingStatus[] = ["pending", "under_review", "confirmed"];

export const isUpcoming = (b: Pick<CustomerBookingView, "eventDate" | "status">, today: string) =>
  b.eventDate >= today && ACTIVE.includes(b.status);

export const isPast = (b: Pick<CustomerBookingView, "eventDate" | "status">, today: string) =>
  b.status === "completed" || (b.eventDate < today && (ACTIVE.includes(b.status)));

export const BOOKING_FILTERS = ["all", "upcoming", "past", "pending", "confirmed", "cancelled"] as const;
export type BookingFilter = (typeof BOOKING_FILTERS)[number];
export const FILTER_LABELS: Record<BookingFilter, string> = {
  all: "All",
  upcoming: "Upcoming",
  past: "Past",
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export function parseFilter(value: unknown): BookingFilter {
  return (BOOKING_FILTERS as readonly unknown[]).includes(value) ? (value as BookingFilter) : "all";
}

export function matchesFilter(b: CustomerBookingView, filter: BookingFilter, today: string): boolean {
  switch (filter) {
    case "all":
      return true;
    case "upcoming":
      return isUpcoming(b, today);
    case "past":
      return isPast(b, today);
    case "pending":
      return b.status === "pending" || b.status === "under_review";
    case "confirmed":
      return b.status === "confirmed";
    case "cancelled":
      return b.status === "cancelled";
  }
}

/** Upcoming events first (soonest first), then everything else (most recent first). */
export function sortForCustomer(list: CustomerBookingView[], today: string): CustomerBookingView[] {
  const upcoming = list.filter((b) => isUpcoming(b, today)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const rest = list
    .filter((b) => !isUpcoming(b, today))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.createdAt.localeCompare(a.createdAt));
  return [...upcoming, ...rest];
}

export function nextUpcoming(list: CustomerBookingView[], today: string): CustomerBookingView | null {
  return sortForCustomer(list, today).find((b) => isUpcoming(b, today)) ?? null;
}

export function summaryCounts(list: CustomerBookingView[], today: string) {
  return {
    upcoming: list.filter((b) => isUpcoming(b, today)).length,
    pending: list.filter((b) => b.status === "pending" || b.status === "under_review").length,
    confirmed: list.filter((b) => b.status === "confirmed").length,
    completed: list.filter((b) => b.status === "completed").length,
    cancelled: list.filter((b) => b.status === "cancelled").length,
  };
}

/** Customers may ask for changes only while a booking is active and its date hasn't passed. */
export function canRequestChanges(b: Pick<CustomerBookingView, "eventDate" | "status">, today: string): boolean {
  return ACTIVE.includes(b.status) && b.eventDate >= today;
}

export function toRequestView(
  r: BookingRequestRecord,
  labels: { slot: (id: string) => string; menu: (id: string) => string; service: (id: string) => string }
): CustomerRequestView {
  const c = r.changes ?? {};
  const summary: string[] = [];
  if (c.eventDate) summary.push(`Date: ${c.eventDate}`);
  if (c.slotId) summary.push(`Slot: ${labels.slot(c.slotId)}`);
  if (c.guestCount !== undefined) summary.push(`Guests: ${c.guestCount.toLocaleString("en-US")}`);
  if (c.serviceIds) summary.push(`Services: ${c.serviceIds.map(labels.service).join(", ") || "none"}`);
  if (c.menuPreferenceId !== undefined) summary.push(`Menu: ${c.menuPreferenceId ? labels.menu(c.menuPreferenceId) : "no preference"}`);
  if (c.decorationPreference) summary.push(`Decoration: ${c.decorationPreference}`);
  if (c.notes) summary.push(`Notes: ${c.notes}`);
  return {
    requestId: r.requestId,
    bookingId: r.bookingId,
    type: r.type,
    status: r.status,
    statusLabel: REQUEST_STATUS_LABELS[r.status] ?? r.status,
    summary,
    requestedSlotState: r.requestedSlot?.stateAtRequest ?? null,
    reason: r.reason ?? "",
    createdAt: iso(r.createdAt),
  };
}
