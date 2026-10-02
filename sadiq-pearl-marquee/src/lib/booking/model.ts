// Booking data model (Firestore documents) and the slot uniqueness key.
//
//   bookings/{bookingId}    one document per booking request / booking
//   slotLocks/{slotKey}     at most one document per date + hall + slot; it
//                           exists only while a booking occupies that slot
//
// Both collections are written only by server code, inside transactions
// (see engine.ts). Browsers have no direct access (see firestore.rules).
import type { SlotId } from "./catalog.ts";
import type { PricingSnapshot } from "./pricing.ts";
import type { BookingStatus } from "./status.ts";

export const BOOKING_SOURCES = ["website", "walk_in", "whatsapp", "phone", "other"] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];

export const BOOKINGS_COLLECTION = "bookings";
export const SLOT_LOCKS_COLLECTION = "slotLocks";
export const BOOKING_SCHEMA_VERSION = 1;

/** Deterministic uniqueness key: one active booking per date + hall + slot. */
export function slotKey(date: string, hallId: string, slotId: SlotId): string {
  return `${date}__${hallId}__${slotId}`;
}

/** When each status was reached. Only reached steps are present. */
export interface BookingTimeline {
  submittedAt: Date;
  reviewedAt?: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
}

export const TIMELINE_KEY: Readonly<Record<BookingStatus, keyof BookingTimeline>> = {
  pending: "submittedAt",
  under_review: "reviewedAt",
  confirmed: "confirmedAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
  rejected: "rejectedAt",
  expired: "expiredAt",
};

export interface BookingRecord {
  schemaVersion: number;
  bookingId: string;
  /** Firebase uid of the customer account; null for a walk-in without an account. */
  customerId: string | null;
  /** Contact details as given for this booking (a snapshot, not a live link). */
  customer: { name: string; phone: string; email: string | null };
  /** Who created the record: the customer themselves, or a venue admin. */
  createdBy: { kind: "customer" | "admin"; uid: string };
  source: BookingSource;

  eventDate: string; // YYYY-MM-DD, venue time zone
  hallId: string;
  hallName: string; // snapshot
  slotId: SlotId;
  slotLabel: string; // snapshot
  slotKey: string;

  eventTypeId: string;
  eventTypeLabel: string; // snapshot
  guestCount: number;
  services: { id: string; label: string }[]; // snapshot of selected add-ons
  menuPreference: { id: string; title: string } | null; // snapshot
  /** Phase 6: selected package (snapshot of its name and included service IDs). */
  package?: { id: string; name: string; serviceIds: string[] } | null;

  /** Price calculated by the server when prices are configured; null until then. */
  pricing: PricingSnapshot | null;
  /** Money in whole PKR. Amounts are null until the booking is priced.
   *  Since Phase 7 `advanceReceived` is the TOTAL of all recorded (not voided)
   *  payments — kept under its original name for compatibility — and is only
   *  ever changed together with the payments/{id} documents (finance.ts). */
  payment: {
    currency: "PKR";
    advanceRequired: number | null;
    advanceReceived: number;
    balanceDue: number | null;
    /** Phase 7: number of recorded (not voided) payments. */
    paymentCount?: number;
  };

  status: BookingStatus;
  /** Only for "pending": when its temporary slot hold ends. */
  holdExpiresAt: Date | null;

  customerNotes: string;
  /** Internal; never shown to the customer. */
  adminNotes: string;

  timeline: BookingTimeline;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlotLock {
  slotKey: string;
  date: string;
  hallId: string;
  slotId: SlotId;
  bookingId: string;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  updatedAt: Date;
}

/** Whether a lock still blocks its slot at `now` (an expired pending hold does not). */
export function lockIsActive(lock: Pick<SlotLock, "status" | "holdExpiresAt">, now: Date): boolean {
  if (lock.status === "pending") return lock.holdExpiresAt !== null && lock.holdExpiresAt.getTime() > now.getTime();
  return lock.status === "under_review" || lock.status === "confirmed" || lock.status === "completed";
}

/** Short reference a customer can quote to the venue. */
export function bookingReference(bookingId: string): string {
  return `SP-${bookingId.slice(-8).toUpperCase()}`;
}
