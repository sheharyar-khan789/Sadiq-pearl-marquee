// Communications — SERVER ONLY glue and admin/customer loaders (Phase 9).
import "server-only";
import { business } from "@/lib/config";
import { run } from "./admin-server";
import { NOTIFICATIONS_PAGE_SIZE, toNotificationView, type NotificationView } from "./communications";
import type { CommunicationRecord, NotificationRecord } from "./notifications";
import { bookingStore, logBookingError, withTimeout } from "./server";
import type { BusinessContact } from "./whatsapp-messages";

/** Verified business name and numbers (src/lib/config.ts) for message signatures. */
export function businessContact(): BusinessContact {
  return { name: business.name, phones: business.phones.map((p) => p.display) };
}

// ------------------------------------------------------------ customer

export type NotificationsResult =
  | { ok: true; items: NotificationView[]; unread: number; nextBefore: string | null }
  | { ok: false; reason: "unavailable" | "error" };

/** One page of the customer's own notifications (always fresh; never cached). */
export async function loadCustomerNotifications(uid: string, before: string | null): Promise<NotificationsResult> {
  const store = bookingStore();
  if (!store) return { ok: false, reason: "unavailable" };
  try {
    const beforeDate = before && !Number.isNaN(Date.parse(before)) ? new Date(before) : null;
    const [list, unread] = await withTimeout(
      Promise.all([store.listNotificationsForCustomer(uid, { before: beforeDate, limit: NOTIFICATIONS_PAGE_SIZE + 1 }), store.countUnreadNotifications(uid)]),
      10_000
    );
    // Defence in depth: only this customer's records.
    const own = list.filter((n) => n.customerId === uid);
    const page = own.slice(0, NOTIFICATIONS_PAGE_SIZE);
    return {
      ok: true,
      items: page.map(toNotificationView),
      unread,
      nextBefore: own.length > NOTIFICATIONS_PAGE_SIZE ? new Date(page[page.length - 1].createdAt).toISOString() : null,
    };
  } catch (error) {
    logBookingError("customer notifications", error);
    return { ok: false, reason: "error" };
  }
}

/** Unread count for the account header (fresh; null if it can't be read — never a made-up number). */
export async function loadUnreadCount(uid: string): Promise<number | null> {
  const store = bookingStore();
  if (!store) return null;
  try {
    return await withTimeout(store.countUnreadNotifications(uid), 5_000);
  } catch (error) {
    logBookingError("unread count", error);
    return null;
  }
}

// --------------------------------------------------------------- admin

export const COMM_KINDS = ["all", "notifications", "whatsapp"] as const;
export interface CommunicationsQuery {
  from: string;
  to: string;
  kind: (typeof COMM_KINDS)[number];
  type: string;
  q: string;
}

export interface CommunicationRow {
  id: string;
  kind: "notification" | "whatsapp";
  at: string;
  bookingId: string | null;
  /** Notification type, or WhatsApp template. */
  type: string;
  recipient: string;
  title: string;
  /** What the system can actually prove. */
  status: "created" | "read" | "initiated";
  by: string | null;
}

const RANGE_LIMIT = 300;

export function notificationRow(n: NotificationRecord, customerName: string | null): CommunicationRow {
  return {
    id: n.notificationId,
    kind: "notification",
    at: new Date(n.createdAt).toISOString(),
    bookingId: n.bookingId,
    type: n.type,
    recipient: customerName ?? `Customer account ${n.customerId.slice(0, 6)}…`,
    title: n.title,
    status: n.readAt ? "read" : "created",
    by: null,
  };
}

export function communicationRow(c: CommunicationRecord): CommunicationRow {
  return {
    id: c.communicationId,
    kind: "whatsapp",
    at: new Date(c.createdAt).toISOString(),
    bookingId: c.bookingId,
    type: c.template,
    recipient: `${c.recipient.kind === "vendor" ? "Vendor" : "Customer"}: ${c.recipient.name}`,
    // First line with content (skip the greeting and "This is <venue>.").
    title: c.message.split("\n").find((l) => l.trim() && !l.startsWith("Assalam") && !l.startsWith("This is ")) ?? "",
    status: c.status,
    by: c.initiatedBy.email ?? c.initiatedBy.uid,
  };
}

/** Admin communication center: bounded date range, filtered on the server. */
export function loadCommunications(q: CommunicationsQuery) {
  return run("communications", async (store) => {
    const from = new Date(`${q.from}T00:00:00+05:00`);
    const to = new Date(`${q.to}T23:59:59.999+05:00`);
    const [notifications, messages] = await Promise.all([
      q.kind === "whatsapp" ? Promise.resolve([]) : store.listNotificationsInRange({ from, to, limit: RANGE_LIMIT }),
      q.kind === "notifications" ? Promise.resolve([]) : store.listCommunicationsInRange({ from, to, limit: RANGE_LIMIT }),
    ]);
    const bookings = new Map((await store.getBookings(notifications.map((n) => n.bookingId ?? "").filter(Boolean))).map((b) => [b.bookingId, b]));
    const needle = q.q.toLowerCase();
    const rows = [
      ...notifications.map((n) => notificationRow(n, n.bookingId ? (bookings.get(n.bookingId)?.customer.name ?? null) : null)),
      ...messages.map(communicationRow),
    ]
      .filter((r) => !q.type || r.type === q.type)
      .filter((r) => !needle || r.recipient.toLowerCase().includes(needle) || (r.bookingId ?? "").toLowerCase().includes(needle) || `sp-${(r.bookingId ?? "").slice(-8)}`.includes(needle))
      .sort((a, b) => b.at.localeCompare(a.at));
    return { rows, truncated: notifications.length >= RANGE_LIMIT || messages.length >= RANGE_LIMIT };
  });
}

/** Communication history for one booking (admin booking page). */
export function loadBookingCommunications(bookingId: string, customerName: string | null) {
  return run("booking communications", async (store) => {
    const [n, c] = await Promise.all([store.listNotificationsForBooking(bookingId, 100), store.listCommunicationsForBooking(bookingId, 100)]);
    return [...n.map((x) => notificationRow(x, customerName)), ...c.map(communicationRow)].sort((a, b) => b.at.localeCompare(a.at));
  });
}
