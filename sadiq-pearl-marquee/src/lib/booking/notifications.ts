// Customer notifications and communication records (Phase 9) — data model
// and the ONE place where notification text is produced.
//
//   notifications/{nt_<24hex>}   in-app notification for one customer account
//   communications/{cm_<24hex>}  a staff-initiated message (manual WhatsApp)
//
// In-app notifications are written by server code INSIDE the same transaction
// as the change they describe (booking status, change-request decision,
// payment, quotation). So a notification exists exactly when the change was
// committed: never for a failed or refused action, never twice for a retried
// one (the ID is derived from the event, and the change itself happens once).
// Text is a snapshot taken at that moment (historical record): later changes
// to the booking never rewrite an old notification.
import { createHash } from "node:crypto";
import { formatEventDate, formatPKR } from "./format.ts";
import { bookingReference, type BookingRecord } from "./model.ts";

export const NOTIFICATIONS_COLLECTION = "notifications";
export const COMMUNICATIONS_COLLECTION = "communications";
export const NOTIFICATION_SCHEMA_VERSION = 1;

/** Only events that exist in the system have a type. */
export const NOTIFICATION_TYPES = [
  "BOOKING_SUBMITTED",
  "BOOKING_CREATED_BY_STAFF",
  "BOOKING_UNDER_REVIEW",
  "BOOKING_CONFIRMED",
  "BOOKING_REJECTED",
  "BOOKING_CANCELLED",
  "BOOKING_EXPIRED",
  "BOOKING_COMPLETED",
  "MODIFICATION_REQUESTED",
  "MODIFICATION_APPROVED",
  "MODIFICATION_REJECTED",
  "CANCELLATION_REQUESTED",
  "CANCELLATION_APPROVED",
  "CANCELLATION_REJECTED",
  "QUOTATION_ISSUED",
  "PAYMENT_RECEIVED",
  "PAYMENT_VOIDED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Readonly<Record<NotificationType, string>> = {
  BOOKING_SUBMITTED: "Request received",
  BOOKING_CREATED_BY_STAFF: "Booking added",
  BOOKING_UNDER_REVIEW: "Under review",
  BOOKING_CONFIRMED: "Booking confirmed",
  BOOKING_REJECTED: "Request not accepted",
  BOOKING_CANCELLED: "Booking cancelled",
  BOOKING_EXPIRED: "Request expired",
  BOOKING_COMPLETED: "Event completed",
  MODIFICATION_REQUESTED: "Change request received",
  MODIFICATION_APPROVED: "Change approved",
  MODIFICATION_REJECTED: "Change not approved",
  CANCELLATION_REQUESTED: "Cancellation request received",
  CANCELLATION_APPROVED: "Cancellation approved",
  CANCELLATION_REJECTED: "Cancellation not approved",
  QUOTATION_ISSUED: "Quotation issued",
  PAYMENT_RECEIVED: "Payment received",
  PAYMENT_VOIDED: "Payment corrected",
};

export interface NotificationRecord {
  schemaVersion: number;
  notificationId: string;
  /** Firebase uid of the customer (from the booking; never from a request body). */
  customerId: string;
  bookingId: string | null;
  type: NotificationType;
  /** Snapshot text, customer-safe (no internal notes, reasons, vendors or staff names). */
  title: string;
  message: string;
  /** Internal path only (always /account/...). */
  actionUrl: string | null;
  /** Small, customer-safe values used in the text (reference, amounts, document numbers). */
  metadata: Record<string, string | number | null>;
  channel: "in_app";
  /** The event this notification describes (e.g. "booking:bk_…:confirmed"); the ID is derived from it. */
  dedupeKey: string;
  createdAt: Date;
  readAt: Date | null;
}

export const notificationId = (customerId: string, dedupeKey: string) =>
  `nt_${createHash("sha256").update(`notification\n${customerId}\n${dedupeKey}`).digest("hex").slice(0, 24)}`;

// ------------------------------------------------------------ templates

type Booking = Pick<BookingRecord, "bookingId" | "customerId" | "eventDate" | "slotLabel" | "hallName" | "eventTypeLabel">;

export type NotificationEvent =
  | { type: "BOOKING_SUBMITTED" | "BOOKING_CREATED_BY_STAFF" | "BOOKING_UNDER_REVIEW" | "BOOKING_CONFIRMED" | "BOOKING_REJECTED" | "BOOKING_CANCELLED" | "BOOKING_EXPIRED" | "BOOKING_COMPLETED" }
  | { type: "MODIFICATION_REQUESTED" | "MODIFICATION_REJECTED" | "CANCELLATION_REQUESTED" | "CANCELLATION_APPROVED" | "CANCELLATION_REJECTED"; requestId: string }
  | { type: "MODIFICATION_APPROVED"; requestId: string; previous: { eventDate: string; slotLabel: string } }
  | { type: "QUOTATION_ISSUED"; quotationId: string; quotationNumber: string; total: number }
  | { type: "PAYMENT_RECEIVED"; paymentId: string; receiptNumber: string; amount: number; remaining: number }
  | { type: "PAYMENT_VOIDED"; paymentId: string; receiptNumber: string; amount: number };

const when = (b: Booking) => `${formatEventDate(b.eventDate)} (${b.slotLabel})`;

/** Title + message for an event, from the authoritative records passed in. */
export function renderNotification(e: NotificationEvent, b: Booking): { title: string; message: string; metadata: NotificationRecord["metadata"]; dedupe: string } {
  const ref = bookingReference(b.bookingId);
  const base = { reference: ref, eventDate: b.eventDate };
  const k = (suffix: string) => `booking:${b.bookingId}:${suffix}`;
  switch (e.type) {
    case "BOOKING_SUBMITTED":
      return { title: "Booking request received", message: `We received your ${b.eventTypeLabel} request for ${when(b)}, ${b.hallName}. Reference ${ref}. Our team will review it and contact you.`, metadata: base, dedupe: k("submitted") };
    case "BOOKING_CREATED_BY_STAFF":
      return { title: "Booking added to your account", message: `Our team added your ${b.eventTypeLabel} booking for ${when(b)}, ${b.hallName}. Reference ${ref}.`, metadata: base, dedupe: k("created") };
    case "BOOKING_UNDER_REVIEW":
      return { title: "Your request is under review", message: `Our team is reviewing your request ${ref} for ${when(b)}. The date is held for you while we review it.`, metadata: base, dedupe: k("under_review") };
    case "BOOKING_CONFIRMED":
      return { title: "Booking confirmed", message: `Your ${b.eventTypeLabel} on ${when(b)} at ${b.hallName} is confirmed. Reference ${ref}.`, metadata: base, dedupe: k("confirmed") };
    case "BOOKING_REJECTED":
      return { title: "Booking request not accepted", message: `We're sorry, we couldn't accept request ${ref} for ${when(b)}. Please contact us if you'd like to discuss other dates.`, metadata: base, dedupe: k("rejected") };
    case "BOOKING_CANCELLED":
      return { title: "Booking cancelled", message: `Booking ${ref} for ${when(b)} has been cancelled. Your payment history and receipts stay available in your account.`, metadata: base, dedupe: k("cancelled") };
    case "BOOKING_EXPIRED":
      return { title: "Booking request expired", message: `Request ${ref} for ${when(b)} expired before it could be confirmed, and the date is no longer held. Contact us if you're still interested.`, metadata: base, dedupe: k("expired") };
    case "BOOKING_COMPLETED":
      return { title: "Thank you for celebrating with us", message: `Your event on ${when(b)} (reference ${ref}) is marked as completed.`, metadata: base, dedupe: k("completed") };
    case "MODIFICATION_REQUESTED":
      return { title: "Change request received", message: `We received your change request for booking ${ref}. Your booking stays as it is until our team decides.`, metadata: base, dedupe: `request:${e.requestId}:submitted` };
    case "MODIFICATION_APPROVED": {
      const moved = e.previous.eventDate !== b.eventDate || e.previous.slotLabel !== b.slotLabel;
      return {
        title: "Change approved",
        message: moved
          ? `Your change to booking ${ref} was approved. Your event is now on ${when(b)}, ${b.hallName} (previously ${formatEventDate(e.previous.eventDate)}, ${e.previous.slotLabel}).`
          : `Your change to booking ${ref} was approved. See the booking for the updated details.`,
        metadata: { ...base, previousEventDate: e.previous.eventDate },
        dedupe: `request:${e.requestId}:approved`,
      };
    }
    case "MODIFICATION_REJECTED":
      return { title: "Change request not approved", message: `Your change request for booking ${ref} was not approved. Your booking stays as it was.`, metadata: base, dedupe: `request:${e.requestId}:declined` };
    case "CANCELLATION_REQUESTED":
      return { title: "Cancellation request received", message: `We received your cancellation request for booking ${ref}. Your booking stays active until our team decides.`, metadata: base, dedupe: `request:${e.requestId}:submitted` };
    case "CANCELLATION_APPROVED":
      return {
        title: "Cancellation approved",
        message: `Booking ${ref} for ${when(b)} is cancelled as you requested. Your payment history and receipts stay available; please contact us about any payment already made.`,
        metadata: base,
        dedupe: `request:${e.requestId}:approved`,
      };
    case "CANCELLATION_REJECTED":
      return { title: "Cancellation request not approved", message: `Your cancellation request for booking ${ref} was not approved. Your booking remains active. Please contact us to discuss it.`, metadata: base, dedupe: `request:${e.requestId}:declined` };
    case "QUOTATION_ISSUED":
      return { title: "Quotation issued", message: `Quotation ${e.quotationNumber} for booking ${ref} is ready: total ${formatPKR(e.total)}. You can download it from your booking.`, metadata: { ...base, quotationNumber: e.quotationNumber, total: e.total }, dedupe: `quotation:${e.quotationId}:issued` };
    case "PAYMENT_RECEIVED":
      return {
        title: "Payment received",
        message: `We recorded your payment of ${formatPKR(e.amount)} for booking ${ref}. Receipt ${e.receiptNumber}. Remaining balance: ${formatPKR(e.remaining)}.`,
        metadata: { ...base, receiptNumber: e.receiptNumber, amount: e.amount, remaining: e.remaining },
        dedupe: `payment:${e.paymentId}:recorded`,
      };
    case "PAYMENT_VOIDED":
      return {
        title: "Payment record corrected",
        message: `Payment ${e.receiptNumber} of ${formatPKR(e.amount)} on booking ${ref} was corrected (voided) by our team and no longer counts towards the booking. Please contact us if you have questions.`,
        metadata: { ...base, receiptNumber: e.receiptNumber, amount: e.amount },
        dedupe: `payment:${e.paymentId}:voided`,
      };
  }
}

/** The notification for an event, or null when the booking has no customer account (walk-in). */
export function buildNotification(e: NotificationEvent, b: Booking, now: Date): NotificationRecord | null {
  if (!b.customerId) return null;
  const r = renderNotification(e, b);
  return {
    schemaVersion: NOTIFICATION_SCHEMA_VERSION,
    notificationId: notificationId(b.customerId, r.dedupe),
    customerId: b.customerId,
    bookingId: b.bookingId,
    type: e.type,
    title: r.title,
    message: r.message,
    actionUrl: `/account/bookings/${b.bookingId}`,
    metadata: r.metadata,
    channel: "in_app",
    dedupeKey: r.dedupe,
    createdAt: now,
    readAt: null,
  };
}

/** Booking status -> notification for that transition (statuses without one: none). */
export const STATUS_NOTIFICATION: Partial<Record<BookingRecord["status"], NotificationEvent["type"]>> = {
  under_review: "BOOKING_UNDER_REVIEW",
  confirmed: "BOOKING_CONFIRMED",
  rejected: "BOOKING_REJECTED",
  cancelled: "BOOKING_CANCELLED",
  expired: "BOOKING_EXPIRED",
  completed: "BOOKING_COMPLETED",
};

// -------------------------------------------------------- communications

/** Delivery channels. Automated channels are NOT configured: no provider credentials exist. */
export const COMMUNICATION_CHANNELS = ["manual_whatsapp"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];
/** What the system can actually prove for each channel. */
export const DELIVERY_PROVIDERS = {
  whatsappAutomated: "not_configured",
  email: "not_configured",
  sms: "not_configured",
} as const;

export const WHATSAPP_TEMPLATES = ["booking_confirmation", "payment_confirmation", "quotation", "event_reminder", "general", "vendor_event_details"] as const;
export type WhatsAppTemplate = (typeof WHATSAPP_TEMPLATES)[number];
export const WHATSAPP_TEMPLATE_LABELS: Readonly<Record<WhatsAppTemplate, string>> = {
  booking_confirmation: "Booking confirmation",
  payment_confirmation: "Payment confirmation",
  quotation: "Quotation",
  event_reminder: "Event reminder",
  general: "General message",
  vendor_event_details: "Event details for vendor",
};

/**
 * A message staff opened in WhatsApp. "initiated" is the only status the
 * system can prove: the link was generated for the admin. Whether it was sent
 * or delivered happens inside WhatsApp and is never claimed.
 */
export interface CommunicationRecord {
  schemaVersion: number;
  communicationId: string;
  channel: CommunicationChannel;
  recipient: { kind: "customer" | "vendor"; customerId: string | null; vendorId: string | null; name: string; phone: string };
  bookingId: string | null;
  template: WhatsAppTemplate;
  /** Snapshot of the exact text handed to WhatsApp (historical record). */
  message: string;
  status: "initiated";
  initiatedBy: { uid: string; email: string | null };
  createdAt: Date;
}

export const communicationId = (adminUid: string, requestKey: string) =>
  `cm_${createHash("sha256").update(`communication\n${adminUid}\n${requestKey}`).digest("hex").slice(0, 24)}`;

/**
 * Writes the customer's notification for `e` inside the caller's transaction
 * (no-op for bookings without a customer account). Call in the write phase.
 */
export function notifyInTransaction(
  tx: { createNotification(record: NotificationRecord): void },
  e: NotificationEvent,
  b: Booking,
  now: Date
): void {
  const n = buildNotification(e, b, now);
  if (n) tx.createNotification(n);
}
