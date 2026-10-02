// Admin read model (Phase 5): list rows, server-side filtering / sorting /
// pagination, dashboard figures and customer aggregation. Pure functions.
import { SLOT_IDS } from "./catalog.ts";
import { addDays, daysBetween, isIsoDate } from "./dates.ts";
import { bookingReference, BOOKING_SOURCES, type BookingRecord, type BookingSource } from "./model.ts";
import { BOOKING_STATUSES, STATUS_LABELS, type BookingStatus } from "./status.ts";

export const SOURCE_LABELS: Readonly<Record<BookingSource, string>> = {
  website: "Website",
  walk_in: "Walk-in",
  whatsapp: "WhatsApp",
  phone: "Phone",
  other: "Other",
};

/** Admin status labels are plain operational words (the customer ones are softer). */
export const ADMIN_STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: "Pending",
  under_review: "Under review",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  expired: "Expired",
};

export interface AdminBookingRow {
  bookingId: string;
  reference: string;
  eventDate: string;
  slotId: string;
  slotLabel: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  eventTypeId: string;
  eventTypeLabel: string;
  guestCount: number;
  status: BookingStatus;
  source: BookingSource;
  /** Pending request whose temporary hold has run out (no longer blocks the slot). */
  holdLapsed: boolean;
  total: number | null;
  createdAt: string;
  updatedAt: string;
}

const iso = (d: Date | string) => new Date(d).toISOString();

export function toAdminRow(b: BookingRecord, now: Date): AdminBookingRow {
  return {
    bookingId: b.bookingId,
    reference: bookingReference(b.bookingId),
    eventDate: b.eventDate,
    slotId: b.slotId,
    slotLabel: b.slotLabel,
    customerId: b.customerId,
    customerName: b.customer?.name ?? "",
    customerEmail: b.customer?.email ?? null,
    customerPhone: b.customer?.phone ?? "",
    eventTypeId: b.eventTypeId,
    eventTypeLabel: b.eventTypeLabel,
    guestCount: b.guestCount,
    status: b.status,
    source: b.source,
    holdLapsed: b.status === "pending" && !!b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= now.getTime(),
    total: b.pricing?.total ?? null,
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
  };
}

// ----------------------------------------------------------- list query

export const ADMIN_SORTS = ["date_asc", "date_desc", "created_desc"] as const;
export type AdminSort = (typeof ADMIN_SORTS)[number];
export const ADMIN_PAGE_SIZE = 25;
/** The date window is always bounded so a single query can never read the whole history. */
export const ADMIN_MAX_RANGE_DAYS = 400;

export interface AdminListQuery {
  from: string;
  to: string;
  status: BookingStatus | "";
  slot: string;
  source: BookingSource | "";
  eventType: string;
  q: string;
  sort: AdminSort;
  page: number;
}

const pick = (v: unknown) => (typeof v === "string" ? v : Array.isArray(v) ? String(v[0] ?? "") : "");

export function parseAdminListQuery(params: Record<string, unknown>, today: string): AdminListQuery {
  let from = pick(params.from);
  let to = pick(params.to);
  if (!isIsoDate(from)) from = addDays(today, -30);
  if (!isIsoDate(to)) to = addDays(today, 365);
  if (to < from) [from, to] = [to, from];
  if (daysBetween(from, to) > ADMIN_MAX_RANGE_DAYS) to = addDays(from, ADMIN_MAX_RANGE_DAYS);
  const status = pick(params.status);
  const source = pick(params.source);
  const slot = pick(params.slot);
  const eventType = pick(params.eventType);
  const sort = pick(params.sort);
  const page = Number.parseInt(pick(params.page), 10);
  return {
    from,
    to,
    status: (BOOKING_STATUSES as readonly string[]).includes(status) ? (status as BookingStatus) : "",
    slot: (SLOT_IDS as readonly string[]).includes(slot) ? slot : "",
    source: (BOOKING_SOURCES as readonly string[]).includes(source) ? (source as BookingSource) : "",
    eventType: /^[a-z0-9][a-z0-9-]{0,39}$/.test(eventType) ? eventType : "",
    q: pick(params.q).trim().slice(0, 100),
    sort: (ADMIN_SORTS as readonly string[]).includes(sort) ? (sort as AdminSort) : "date_asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Case-insensitive search over reference, customer name, email and phone digits. */
function matchesSearch(r: AdminBookingRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return (
    r.reference.toLowerCase().includes(needle) ||
    r.bookingId.toLowerCase().includes(needle) ||
    r.customerName.toLowerCase().includes(needle) ||
    (r.customerEmail ?? "").toLowerCase().includes(needle) ||
    (digits.length >= 4 && r.customerPhone.replace(/\D/g, "").includes(digits))
  );
}

export function applyAdminListQuery(rows: AdminBookingRow[], q: AdminListQuery) {
  const filtered = rows.filter(
    (r) =>
      r.eventDate >= q.from &&
      r.eventDate <= q.to &&
      (!q.status || r.status === q.status) &&
      (!q.slot || r.slotId === q.slot) &&
      (!q.source || r.source === q.source) &&
      (!q.eventType || r.eventTypeId === q.eventType) &&
      matchesSearch(r, q.q)
  );
  const sorted = [...filtered].sort((a, b) =>
    q.sort === "date_desc"
      ? b.eventDate.localeCompare(a.eventDate) || a.slotId.localeCompare(b.slotId)
      : q.sort === "created_desc"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.eventDate.localeCompare(b.eventDate) || a.slotId.localeCompare(b.slotId)
  );
  const pages = Math.max(1, Math.ceil(sorted.length / ADMIN_PAGE_SIZE));
  const page = Math.min(q.page, pages);
  return { total: sorted.length, page, pages, rows: sorted.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE) };
}

// ------------------------------------------------------------- dashboard

export function statusLabel(s: BookingStatus): string {
  return ADMIN_STATUS_LABELS[s] ?? STATUS_LABELS[s] ?? s;
}

// ------------------------------------------------------------- customers

export interface AdminCustomerRow {
  key: string;
  /** Online account uid, or null for an offline (walk-in / phone) customer. */
  uid: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  bookingCount: number;
  latest: { bookingId: string; eventDate: string; status: BookingStatus } | null;
}

export interface ProfileLike {
  uid: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

/**
 * Customers = Firebase users (users/{uid}) plus offline contacts found on
 * staff-entered bookings (grouped by phone digits). No separate customer DB.
 */
export function aggregateCustomers(profiles: ProfileLike[], bookings: BookingRecord[]): AdminCustomerRow[] {
  const rows = new Map<string, AdminCustomerRow>();
  for (const p of profiles) {
    rows.set(`u:${p.uid}`, { key: `u:${p.uid}`, uid: p.uid, name: p.name ?? "", email: p.email, phone: p.phone, bookingCount: 0, latest: null });
  }
  for (const b of bookings) {
    const key = b.customerId ? `u:${b.customerId}` : `p:${(b.customer?.phone ?? "").replace(/\D/g, "") || b.bookingId}`;
    const row =
      rows.get(key) ??
      ({
        key,
        uid: b.customerId,
        name: b.customer?.name ?? "",
        email: b.customer?.email ?? null,
        phone: b.customer?.phone ?? null,
        bookingCount: 0,
        latest: null,
      } satisfies AdminCustomerRow);
    row.bookingCount += 1;
    if (!row.name && b.customer?.name) row.name = b.customer.name;
    if (!row.phone && b.customer?.phone) row.phone = b.customer.phone;
    if (!row.latest || b.eventDate > row.latest.eventDate) {
      row.latest = { bookingId: b.bookingId, eventDate: b.eventDate, status: b.status };
    }
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) => (b.latest?.eventDate ?? "").localeCompare(a.latest?.eventDate ?? "") || a.name.localeCompare(b.name)
  );
}

export function searchCustomers(rows: AdminCustomerRow[], q: string): AdminCustomerRow[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  const digits = needle.replace(/\D/g, "");
  return rows.filter(
    (r) =>
      r.name.toLowerCase().includes(needle) ||
      (r.email ?? "").toLowerCase().includes(needle) ||
      (digits.length >= 4 && (r.phone ?? "").replace(/\D/g, "").includes(digits))
  );
}
