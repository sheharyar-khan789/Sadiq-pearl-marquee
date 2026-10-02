// Booking statuses and the rules for moving between them. The only place
// that decides which statuses occupy a slot.

export const BOOKING_STATUSES = [
  "pending", // submitted by the customer, not yet looked at
  "under_review", // venue team is reviewing it
  "confirmed",
  "completed", // the event has taken place
  "cancelled",
  "rejected",
  "expired", // a pending request whose temporary hold ran out
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === "string" && (BOOKING_STATUSES as readonly string[]).includes(value);
}

/**
 * Slot occupation rule:
 *  - confirmed, completed: occupy the slot permanently.
 *  - under_review: occupies the slot while the venue team decides.
 *  - pending: occupies the slot only temporarily, until its hold expires
 *    (bookingPolicy.pendingHoldHours). An expired hold never blocks anyone.
 *  - cancelled, rejected, expired: release the slot.
 */
export const SLOT_HOLDING_STATUSES: readonly BookingStatus[] = ["pending", "under_review", "confirmed", "completed"];

export function holdsSlot(status: BookingStatus): boolean {
  return SLOT_HOLDING_STATUSES.includes(status);
}

/** A customer's open requests (counted against the per-customer limit). */
export const OPEN_REQUEST_STATUSES: readonly BookingStatus[] = ["pending", "under_review"];

/** Allowed status changes. Final states have no way out. */
export const STATUS_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ["under_review", "confirmed", "rejected", "cancelled", "expired"],
  under_review: ["confirmed", "rejected", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
  expired: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Customer-facing wording for each status. */
export const STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: "Request received",
  under_review: "Under review",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Not accepted",
  expired: "Expired",
};
