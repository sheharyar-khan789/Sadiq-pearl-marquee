// Upcoming-events list for the operations screens (Phase 8): query parsing,
// filtering and serialisable rows. Pure functions (unit-tested); the data
// comes from the booking store with a bounded date-range query.
import { addDays, isIsoDate } from "./dates.ts";
import { financialSummary, type FinancialStatus } from "./finance-model.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import { isOperationalBooking, OPS_STATUSES, type EventOperationsRecord, type OpsStatus } from "./operations-model.ts";

export const EVENT_RANGES = ["today", "tomorrow", "7d", "30d", "custom"] as const;
export type EventRange = (typeof EVENT_RANGES)[number];
export const EVENT_RANGE_LABELS: Readonly<Record<EventRange, string>> = {
  today: "Today",
  tomorrow: "Tomorrow",
  "7d": "Next 7 days",
  "30d": "Next 30 days",
  custom: "Date range",
};
/** A custom range is capped so one query never reads the whole history. */
export const EVENTS_MAX_RANGE_DAYS = 92;

export interface EventsQuery {
  range: EventRange;
  from: string;
  to: string;
  slot: string | null;
  ops: OpsStatus | null;
  /** "confirmed" (upcoming events), "completed" (history) or "all" (both). */
  booking: "confirmed" | "completed" | "all";
  q: string;
}

const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseEventsQuery(params: Record<string, string | string[] | undefined>, today: string): EventsQuery {
  const range = (EVENT_RANGES as readonly string[]).includes(pick(params.range) ?? "") ? (pick(params.range) as EventRange) : "30d";
  let from = today;
  let to = addDays(today, 30);
  if (range === "today") to = today;
  if (range === "tomorrow") from = to = addDays(today, 1);
  if (range === "7d") to = addDays(today, 6);
  if (range === "custom") {
    const f = pick(params.from);
    const t = pick(params.to);
    from = isIsoDate(f) ? f : today;
    to = isIsoDate(t) && t >= from ? t : addDays(from, 30);
    if (to > addDays(from, EVENTS_MAX_RANGE_DAYS)) to = addDays(from, EVENTS_MAX_RANGE_DAYS);
  }
  const ops = pick(params.ops);
  const booking = pick(params.booking);
  return {
    range,
    from,
    to,
    slot: pick(params.slot)?.slice(0, 40) || null,
    ops: (OPS_STATUSES as readonly string[]).includes(ops ?? "") ? (ops as OpsStatus) : null,
    booking: booking === "completed" || booking === "all" ? booking : "confirmed",
    q: (pick(params.q) ?? "").trim().slice(0, 80),
  };
}

export interface EventRow {
  bookingId: string;
  reference: string;
  eventDate: string;
  slotId: string;
  slotLabel: string;
  hallName: string;
  eventTypeLabel: string;
  guestCount: number;
  customerName: string;
  customerPhone: string;
  bookingStatus: BookingRecord["status"];
  opsStatus: OpsStatus;
  checklistDone: number;
  checklistTotal: number;
  financialStatus: FinancialStatus;
  remaining: number | null;
}

export function toEventRow(b: BookingRecord, ops: EventOperationsRecord | null): EventRow {
  const active = ops?.checklist.filter((i) => !i.removed) ?? [];
  const f = financialSummary(b);
  return {
    bookingId: b.bookingId,
    reference: bookingReference(b.bookingId),
    eventDate: b.eventDate,
    slotId: b.slotId,
    slotLabel: b.slotLabel,
    hallName: b.hallName,
    eventTypeLabel: b.eventTypeLabel,
    guestCount: b.guestCount,
    customerName: b.customer?.name ?? "",
    customerPhone: b.customer?.phone ?? "",
    bookingStatus: b.status,
    opsStatus: ops?.status ?? "not_started",
    checklistDone: active.filter((i) => i.status === "completed").length,
    checklistTotal: active.length,
    financialStatus: f.status,
    remaining: f.remaining,
  };
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Applies the filters to bookings already limited to the date range on the
 * server. Cancelled, rejected, pending and expired bookings never appear: only
 * confirmed (upcoming) and/or completed events are operational.
 */
export function applyEventsQuery(bookings: BookingRecord[], opsById: Map<string, EventOperationsRecord>, q: EventsQuery): EventRow[] {
  const needle = q.q.toLowerCase();
  const needleDigits = digits(q.q);
  return bookings
    .filter((b) => isOperationalBooking(b))
    .filter((b) => q.booking === "all" || b.status === q.booking)
    .filter((b) => b.eventDate >= q.from && b.eventDate <= q.to)
    .filter((b) => !q.slot || b.slotId === q.slot)
    .map((b) => toEventRow(b, opsById.get(b.bookingId) ?? null))
    .filter((r) => !q.ops || r.opsStatus === q.ops)
    .filter((r) => {
      if (!needle) return true;
      return (
        r.reference.toLowerCase().includes(needle) ||
        r.customerName.toLowerCase().includes(needle) ||
        r.eventTypeLabel.toLowerCase().includes(needle) ||
        r.eventDate.includes(needle) ||
        (needleDigits.length >= 4 && digits(r.customerPhone).includes(needleDigits))
      );
    })
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.slotId.localeCompare(b.slotId));
}
