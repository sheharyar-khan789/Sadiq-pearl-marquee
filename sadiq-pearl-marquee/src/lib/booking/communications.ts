// Notification read state and manual WhatsApp communication (Phase 9) — SERVER ONLY in use.
//
// Customers: functions take the uid from the verified session; a notification
// that isn't theirs is "not found". They can only set readAt — never type,
// owner, text or anything else.
// Admin: a manual WhatsApp message is built on the server from authoritative
// records, recorded (status "initiated" — the only provable state) and audited
// in ONE transaction, and only then is the wa.me link returned. Nothing here
// changes a booking, payment, quotation, receipt, operation or vendor.
import { auditRecord } from "./engine.ts";
import { businessToday } from "./dates.ts";
import { isOperationalBooking, VENDOR_CATEGORY_LABELS } from "./operations-model.ts";
import {
  communicationId,
  WHATSAPP_TEMPLATES,
  type CommunicationRecord,
  type NotificationRecord,
  type WhatsAppTemplate,
} from "./notifications.ts";
import { buildWhatsAppMessage, normalizeWhatsAppNumber, whatsAppLink, type BusinessContact, type TemplateError, type TemplateInput } from "./whatsapp-messages.ts";
import type { AdminActor } from "./audit-model.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";

export const NOTIFICATIONS_PAGE_SIZE = 20;
const NOTIFICATION_ID = /^nt_[0-9a-f]{24}$/;

// ------------------------------------------------------------ customers

export async function markNotificationRead(
  store: BookingStore,
  uid: string,
  id: unknown,
  options: { now?: Date } = {}
): Promise<{ ok: true; changed: boolean } | { ok: false; code: "not_found" }> {
  if (!uid || typeof id !== "string" || !NOTIFICATION_ID.test(id)) return { ok: false, code: "not_found" };
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx) => {
    const found = await tx.getNotification(id);
    // Someone else's notification is indistinguishable from a missing one.
    if (!found || found.data.customerId !== uid) return { ok: false as const, code: "not_found" as const };
    if (found.data.readAt) return { ok: true as const, changed: false };
    tx.updateNotification(id, { readAt: now }, found.version);
    return { ok: true as const, changed: true };
  });
}

/** Marks up to 200 of the customer's unread notifications read (repeat for more). */
export async function markAllNotificationsRead(store: BookingStore, uid: string, options: { now?: Date } = {}): Promise<{ ok: true; count: number }> {
  if (!uid) return { ok: true, count: 0 };
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx) => {
    const unread = (await tx.listUnreadNotifications(uid, 200)).filter((n) => n.data.customerId === uid);
    for (const n of unread) tx.updateNotification(n.data.notificationId, { readAt: now }, n.version);
    return { ok: true as const, count: unread.length };
  });
}

/** Customer-safe serialisable view (the stored record holds nothing internal). */
export interface NotificationView {
  notificationId: string;
  type: NotificationRecord["type"];
  title: string;
  message: string;
  actionUrl: string | null;
  createdAt: string;
  read: boolean;
}
export const toNotificationView = (n: NotificationRecord): NotificationView => ({
  notificationId: n.notificationId,
  type: n.type,
  title: n.title,
  message: n.message,
  // Only internal account paths are ever rendered as links.
  actionUrl: n.actionUrl && /^\/account\/[A-Za-z0-9/_-]*$/.test(n.actionUrl) ? n.actionUrl : null,
  createdAt: new Date(n.createdAt).toISOString(),
  read: n.readAt !== null,
});

// --------------------------------------------------------------- admin

export interface WhatsAppRequest {
  bookingId: string;
  template: WhatsAppTemplate;
  paymentId: string | null;
  quotationId: string | null;
  assignmentId: string | null;
}

/** Validates the admin's request shape (identity and record ownership are checked in the transaction). */
export function validateWhatsAppRequest(raw: unknown): { ok: true; value: WhatsAppRequest } | { ok: false } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false };
  const b = raw as Record<string, unknown>;
  const allowed = ["bookingId", "template", "paymentId", "quotationId", "assignmentId", "requestKey"];
  if (Object.keys(b).some((k) => !allowed.includes(k))) return { ok: false };
  const id = (v: unknown, re: RegExp) => (v === undefined || v === null || v === "" ? null : typeof v === "string" && re.test(v) ? v : undefined);
  const paymentId = id(b.paymentId, /^pay_[0-9a-f]{24}$/);
  const quotationId = id(b.quotationId, /^qt_[0-9a-f]{32}$/);
  const assignmentId = id(b.assignmentId, /^va_[0-9a-f]{24}$/);
  if (typeof b.bookingId !== "string" || !/^bk_[0-9a-f]{24}$/.test(b.bookingId)) return { ok: false };
  if (!(WHATSAPP_TEMPLATES as readonly unknown[]).includes(b.template)) return { ok: false };
  if (paymentId === undefined || quotationId === undefined || assignmentId === undefined) return { ok: false };
  const template = b.template as WhatsAppTemplate;
  if (template === "payment_confirmation" && !paymentId) return { ok: false };
  if (template === "quotation" && !quotationId) return { ok: false };
  if (template === "vendor_event_details" && !assignmentId) return { ok: false };
  return { ok: true, value: { bookingId: b.bookingId, template, paymentId, quotationId, assignmentId } };
}

export type WhatsAppFailure = "not_found" | "record_not_found" | "phone_unusable" | "duplicate_request" | "invalid_request_key" | TemplateError;
export type PreparedWhatsApp = {
  message: string;
  url: string;
  recipient: CommunicationRecord["recipient"];
};

/** Reads the authoritative records and builds the message + link (no writes). */
async function prepare(
  tx: BookingTransaction,
  req: WhatsAppRequest,
  business: BusinessContact,
  now: Date
): Promise<{ ok: true; value: PreparedWhatsApp } | { ok: false; code: WhatsAppFailure }> {
  const found = await tx.getBooking(req.bookingId);
  if (!found) return { ok: false, code: "not_found" };
  const booking = found.data;
  let input: TemplateInput;
  let recipient: CommunicationRecord["recipient"];
  if (req.template === "vendor_event_details") {
    const a = await tx.getAssignment(req.assignmentId!);
    if (!a || a.data.bookingId !== booking.bookingId || a.data.status === "cancelled") return { ok: false, code: "record_not_found" };
    const v = await tx.getVendor(a.data.vendorId);
    if (!v) return { ok: false, code: "record_not_found" };
    if (!isOperationalBooking(booking)) return { ok: false, code: "booking_not_confirmed" };
    // Vendor contact comes ONLY from the vendor record.
    recipient = { kind: "vendor", customerId: null, vendorId: v.data.vendorId, name: v.data.name, phone: v.data.whatsapp ?? v.data.phone };
    input = { template: "vendor_event_details", booking, vendorName: v.data.name, category: VENDOR_CATEGORY_LABELS[a.data.category] };
  } else {
    recipient = { kind: "customer", customerId: booking.customerId, vendorId: null, name: booking.customer.name, phone: booking.customer.phone };
    if (req.template === "payment_confirmation") {
      const p = await tx.getPayment(req.paymentId!);
      if (!p) return { ok: false, code: "record_not_found" };
      input = { template: "payment_confirmation", booking, payment: p.data };
    } else if (req.template === "quotation") {
      const q = await tx.getQuotation(req.quotationId!);
      if (!q) return { ok: false, code: "record_not_found" };
      input = { template: "quotation", booking, quotation: q.data };
    } else {
      input = { template: req.template, booking } as TemplateInput;
    }
  }
  const built = buildWhatsAppMessage(input, business, businessToday(now));
  if (!built.ok) return built;
  const number = normalizeWhatsAppNumber(recipient.phone);
  if (!number) return { ok: false, code: "phone_unusable" };
  return { ok: true, value: { message: built.message, url: whatsAppLink(number, built.message), recipient } };
}

/** Preview only: nothing is recorded. */
export async function previewWhatsApp(store: BookingStore, req: WhatsAppRequest, business: BusinessContact, options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  return store.runTransaction((tx) => prepare(tx, req, business, now));
}

/**
 * Records the message as "initiated" (+ audit) and returns the wa.me link.
 * The same form submitted twice returns the same record (no duplicate).
 */
export async function initiateWhatsApp(
  store: BookingStore,
  actor: AdminActor,
  req: WhatsAppRequest,
  requestKey: unknown,
  business: BusinessContact,
  options: { now?: Date } = {}
): Promise<{ ok: true; communication: CommunicationRecord; url: string; replayed: boolean } | { ok: false; code: WhatsAppFailure }> {
  if (typeof requestKey !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(requestKey)) return { ok: false, code: "invalid_request_key" };
  const now = options.now ?? new Date();
  const id = communicationId(actor.uid, requestKey);
  return store.runTransaction(async (tx) => {
    const existing = await tx.getCommunication(id);
    if (existing) {
      if (existing.data.bookingId !== req.bookingId || existing.data.template !== req.template) return { ok: false as const, code: "duplicate_request" as const };
      const number = normalizeWhatsAppNumber(existing.data.recipient.phone);
      if (!number) return { ok: false as const, code: "phone_unusable" as const };
      return { ok: true as const, communication: existing.data, url: whatsAppLink(number, existing.data.message), replayed: true };
    }
    const prepared = await prepare(tx, req, business, now);
    if (!prepared.ok) return prepared;
    const record: CommunicationRecord = {
      schemaVersion: 1,
      communicationId: id,
      channel: "manual_whatsapp",
      recipient: prepared.value.recipient,
      bookingId: req.bookingId,
      template: req.template,
      message: prepared.value.message,
      status: "initiated",
      initiatedBy: { uid: actor.uid, email: actor.email ?? null },
      createdAt: now,
    };
    tx.createCommunication(record);
    // The audit keeps what happened, not the message text or the phone number.
    tx.createAudit({
      ...auditRecord("whatsapp_initiated", actor, req.bookingId, now, {
        after: { template: req.template, recipient: prepared.value.recipient.kind, channel: "manual_whatsapp" },
      }),
      entityType: "communication",
      entityId: id,
    });
    return { ok: true as const, communication: record, url: prepared.value.url, replayed: false };
  });
}
