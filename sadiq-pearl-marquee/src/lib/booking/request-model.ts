// Customer change requests (Phase 4): bookingRequests/{requestId}.
//
// A request NEVER changes the booking or its slot lock. It records what the
// customer asked for, tied to the booking and to the customer's verified uid,
// for the venue team to review in a later (admin) phase. Written only by
// server code; browsers have no direct access (see firestore.rules).
import type { SlotId } from "./catalog.ts";
import type { SlotState } from "./availability.ts";
import type { BookingStatus } from "./status.ts";

export const BOOKING_REQUESTS_COLLECTION = "bookingRequests";
export const REQUEST_SCHEMA_VERSION = 1;

export const BOOKING_REQUEST_TYPES = ["modification", "cancellation"] as const;
export type BookingRequestType = (typeof BOOKING_REQUEST_TYPES)[number];

/**
 * open: waiting for the venue team (the only status a customer can create).
 * accepted / declined / withdrawn: set by future admin tools.
 */
export const BOOKING_REQUEST_STATUSES = ["open", "accepted", "declined", "withdrawn"] as const;
export type BookingRequestStatus = (typeof BOOKING_REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Readonly<Record<BookingRequestStatus, string>> = {
  open: "Waiting for review",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

/** What a customer may ask to change. Absent = unchanged. */
export interface RequestedChanges {
  eventDate?: string;
  slotId?: SlotId;
  guestCount?: number;
  serviceIds?: string[];
  /** null = "no menu preference". */
  menuPreferenceId?: string | null;
  decorationPreference?: string;
  notes?: string;
}

export interface BookingRequestRecord {
  schemaVersion: number;
  requestId: string;
  bookingId: string;
  /** From the verified session, never from the request body. */
  customerId: string;
  type: BookingRequestType;
  status: BookingRequestStatus;
  /** Modification only. */
  changes: RequestedChanges | null;
  /** Modification to another date/slot: that slot's state when requested (informational; nothing is reserved). */
  requestedSlot: { slotKey: string; stateAtRequest: SlotState } | null;
  /** Cancellation only (optional). */
  reason: string;
  /** The booking as it was when the request was made. */
  bookingSnapshot: {
    eventDate: string;
    slotId: SlotId;
    guestCount: number;
    menuPreferenceId: string | null;
    status: BookingStatus;
  };
  createdAt: Date;
  updatedAt: Date;
  decidedAt: Date | null;
  /** Phase 5: the admin who decided (absent until decided). */
  decidedBy?: { uid: string } | null;
  /** Phase 5: internal reason for the decision (admin-only; not shown to customers). */
  decisionReason?: string;
}
