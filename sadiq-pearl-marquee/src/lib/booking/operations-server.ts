// Event operations data loading for admin pages (Phase 8) — SERVER ONLY.
// Every loader runs through admin-server's run(), which verifies the Super
// Admin before any database read. Reads are bounded (date-range queries,
// limits); nothing loads a whole collection.
import "server-only";
import { AUDIT_LABELS, type AuditRecord } from "./audit-model";
import { activeSlots, DEFAULT_HALL_ID } from "./catalog";
import { configOrThrow, labelsFor, run } from "./admin-server";
import { addDays, businessToday } from "./dates";
import { getAvailability } from "./engine";
import type { DayAvailability } from "./availability";
import { financialSummary, type FinancialSummary } from "./finance-model";
import type { BookingRecord } from "./model";
import { bookingReference } from "./model";
import { assignmentConflicts, newOperations, type VendorConflict } from "./operations";
import {
  checklistDrift,
  isOperationalBooking,
  type EventOperationsRecord,
  type VendorAssignmentRecord,
  type VendorRecord,
} from "./operations-model";
import { applyEventsQuery, toEventRow, type EventRow, type EventsQuery } from "./operations-view";

const OPS_AUDIT_ACTIONS = new Set<string>([
  "ops_status_changed",
  "checklist_item_updated",
  "checklist_item_added",
  "checklist_synced",
  "ops_note_added",
  "ops_note_updated",
  "vendor_assigned",
  "vendor_assignment_confirmed",
  "vendor_unassigned",
]);

// ------------------------------------------------------------ upcoming events

export interface EventsData {
  today: string;
  query: EventsQuery;
  rows: EventRow[];
  slots: { id: string; label: string }[];
  /** True when the range held more bookings than one page reads (narrow the range). */
  truncated: boolean;
}

const RANGE_LIMIT = 500;

export function loadEvents(query: EventsQuery) {
  return run("events", async (store): Promise<EventsData> => {
    const config = await configOrThrow();
    const bookings = await store.listBookingsInRange({ from: query.from, to: query.to, limit: RANGE_LIMIT });
    const operational = bookings.filter(isOperationalBooking);
    const ops = await store.getOperationsMany(operational.map((b) => b.bookingId));
    return {
      today: businessToday(new Date()),
      query,
      rows: applyEventsQuery(operational, new Map(ops.map((o) => [o.bookingId, o])), query),
      slots: activeSlots(config).map((s) => ({ id: s.id, label: s.label })),
      truncated: bookings.length >= RANGE_LIMIT,
    };
  });
}

// ------------------------------------------------------------- event sheet

export interface EventSheet {
  today: string;
  booking: BookingRecord;
  reference: string;
  /** Whether operations can be changed (confirmed or completed booking). */
  operational: boolean;
  /** The stored record, or a preview of the one that will be created on the first change. */
  operations: EventOperationsRecord;
  stored: boolean;
  checklistOutOfDate: boolean;
  finance: FinancialSummary;
  assignments: (VendorAssignmentRecord & { vendor: Pick<VendorRecord, "phone" | "whatsapp" | "email" | "active"> | null })[];
  conflicts: Record<string, VendorConflict[]>;
  vendors: Pick<VendorRecord, "vendorId" | "name" | "category">[];
  history: (AuditRecord & { label: string })[];
}

export function loadEventSheet(bookingId: string) {
  return run("event sheet", async (store): Promise<EventSheet | null> => {
    if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return null;
    const now = new Date();
    const booking = await store.getBooking(bookingId);
    if (!booking) return null;
    const config = await configOrThrow();
    const labels = labelsFor(config);
    const [stored, assignments, vendors, audit] = await Promise.all([
      store.getOperations(bookingId),
      store.listAssignmentsForBooking(bookingId),
      store.listVendors({ activeOnly: true, limit: 300 }),
      store.listAuditForBooking(bookingId, 100),
    ]);
    const operations = stored ?? newOperations(booking, labels, now);
    const vendorDetails = await Promise.all(assignments.map((a) => store.getVendor(a.vendorId)));
    return {
      today: businessToday(now),
      booking,
      reference: bookingReference(bookingId),
      operational: isOperationalBooking(booking),
      operations,
      stored: stored !== null,
      checklistOutOfDate: stored !== null && checklistDrift(stored.checklist, booking, labels),
      finance: financialSummary(booking),
      assignments: assignments.map((a, i) => {
        const v = vendorDetails[i];
        return { ...a, vendor: v ? { phone: v.phone, whatsapp: v.whatsapp, email: v.email, active: v.active } : null };
      }),
      // Recomputed from CURRENT booking data, so a moved event shows new clashes.
      conflicts: booking.status === "confirmed" ? await assignmentConflicts(store, booking, assignments) : {},
      vendors: vendors.map((v) => ({ vendorId: v.vendorId, name: v.name, category: v.category })),
      history: audit.filter((a) => OPS_AUDIT_ACTIONS.has(a.action)).map((a) => ({ ...a, label: AUDIT_LABELS[a.action] ?? a.action })),
    };
  });
}

// ------------------------------------------------------------- vendors

export function loadVendors(show: "active" | "all") {
  return run("vendors", async (store) => store.listVendors({ activeOnly: show === "active", limit: 500 }));
}

export interface VendorDetail {
  vendor: VendorRecord;
  assignments: (VendorAssignmentRecord & { event: Pick<EventRow, "reference" | "eventDate" | "slotLabel" | "bookingStatus"> | null })[];
  history: (AuditRecord & { label: string })[];
}

export function loadVendor(vendorId: string) {
  return run("vendor", async (store): Promise<VendorDetail | null> => {
    if (!/^vd_[0-9a-f]{20}$/.test(vendorId)) return null;
    const vendor = await store.getVendor(vendorId);
    if (!vendor) return null;
    const [assignments, history] = await Promise.all([
      store.listAssignmentsOfVendor(vendorId, 100),
      store.listAuditForEntity("vendor", vendorId, 50),
    ]);
    const bookings = new Map((await store.getBookings(assignments.map((a) => a.bookingId))).map((b) => [b.bookingId, b]));
    return {
      vendor,
      assignments: assignments.map((a) => {
        const b = bookings.get(a.bookingId);
        return { ...a, event: b ? { reference: bookingReference(b.bookingId), eventDate: b.eventDate, slotLabel: b.slotLabel, bookingStatus: b.status } : null };
      }),
      history: history.map((h) => ({ ...h, label: AUDIT_LABELS[h.action] ?? h.action })),
    };
  });
}

// ------------------------------------------------------ calendar week / day

export interface CalendarRangeData {
  today: string;
  from: string;
  to: string;
  days: DayAvailability[];
  /** Operational event rows keyed "date|slotId" (confirmed / completed bookings; one per hall). */
  events: Record<string, EventRow[]>;
  /** Other slot-holding bookings (pending / under review) keyed "date|slotId". */
  requests: Record<string, { bookingId: string; reference: string; customerName: string; status: BookingRecord["status"] }>;
  slots: { id: string; label: string }[];
}

/** Week (7 days) or day view: availability from the booking engine + operational status. */
export function loadCalendarRange(from: string, days: number) {
  return run("calendar range", async (store): Promise<CalendarRangeData> => {
    const now = new Date();
    const to = addDays(from, days - 1);
    const config = await configOrThrow();
    const [availability, bookings, locks] = await Promise.all([
      getAvailability(store, DEFAULT_HALL_ID, from, to, { now, config }),
      store.listBookingsInRange({ from, to, limit: 200 }),
      store.listLocks(DEFAULT_HALL_ID, from, to),
    ]);
    if (!availability.ok) throw new Error(availability.code);
    const operational = bookings.filter(isOperationalBooking);
    const ops = new Map((await store.getOperationsMany(operational.map((b) => b.bookingId))).map((o) => [o.bookingId, o]));
    const events: CalendarRangeData["events"] = {};
    for (const b of operational) (events[`${b.eventDate}|${b.slotId}`] ??= []).push(toEventRow(b, ops.get(b.bookingId) ?? null));
    const byId = new Map(bookings.map((b) => [b.bookingId, b]));
    const requests: CalendarRangeData["requests"] = {};
    for (const l of locks) {
      const b = byId.get(l.bookingId);
      if (b && !isOperationalBooking(b) && !events[`${l.date}|${l.slotId}`]) {
        requests[`${l.date}|${l.slotId}`] = { bookingId: b.bookingId, reference: bookingReference(b.bookingId), customerName: b.customer.name, status: b.status };
      }
    }
    return {
      today: businessToday(now),
      from,
      to,
      days: availability.availability.days,
      events,
      requests,
      slots: activeSlots(config).map((s) => ({ id: s.id, label: s.label })),
    };
  });
}
