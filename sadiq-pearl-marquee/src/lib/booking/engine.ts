// Booking & availability engine — SERVER ONLY (called from API routes and,
// later, admin tools). The authoritative place where bookings are created,
// change status, and claim or release slots.
//
// Double-booking protection: a booking and its slot lock
// (slotLocks/{date__hall__slot}) are written in ONE transaction. The lock is
// created with a "must not exist" precondition, or replaced only if it is
// unchanged since it was read and had expired. If two requests race for the
// same slot, at most one commit succeeds; the other transaction is retried,
// sees the lock, and reports "slot_unavailable".
import { createHash, randomUUID } from "node:crypto";
import {
  DEFAULT_CONFIG,
  getEventType,
  getHall,
  getMenu,
  getPackage,
  getService,
  getSlot,
  type BusinessConfig,
  type HallConfig,
} from "../config/business-config.ts";
import { buildAvailability, type AvailabilityResponse } from "./availability.ts";
import { businessToday, daysBetween, isIsoDate } from "./dates.ts";
import { eventDateError, guestCountError } from "./validation.ts";
import {
  BOOKING_SCHEMA_VERSION,
  lockIsActive,
  slotKey,
  TIMELINE_KEY,
  type BookingRecord,
  type BookingSource,
  type SlotLock,
} from "./model.ts";
import { quote } from "./pricing.ts";
import { canTransition, holdsSlot, OPEN_REQUEST_STATUSES, type BookingStatus } from "./status.ts";
import type { AdminActor, AuditAction, AuditRecord } from "./audit-model.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";
import { notifyInTransaction, STATUS_NOTIFICATION } from "./notifications.ts";
import type { BookingRequestInput } from "./validation.ts";

export interface EngineOptions {
  now?: Date;
  /** The business configuration to use (Phase 6). Defaults to DEFAULT_CONFIG (the Phase 3 values). */
  config?: BusinessConfig;
}

/** Builds an audit record (Phase 5). Written inside the same transaction as the change. */
export function auditRecord(
  action: AuditAction,
  actor: AdminActor,
  bookingId: string,
  now: Date,
  extra: {
    requestId?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    reason?: string;
  } = {}
): AuditRecord {
  return {
    auditId: `aud_${randomUUID().replace(/-/g, "")}`,
    action,
    actor: { uid: actor.uid, email: actor.email ?? null },
    bookingId,
    requestId: extra.requestId ?? null,
    before: extra.before ?? null,
    after: extra.after ?? null,
    reason: extra.reason ?? "",
    at: now,
  };
}

export type CreateFailure = "slot_unavailable" | "too_many_open_requests" | "invalid_request";
export type CreateResult =
  | { ok: true; duplicate: boolean; booking: BookingRecord }
  | { ok: false; code: CreateFailure };

/** Booking IDs are derived from the creator and their request key, so the same
 *  submission sent twice maps to the same document (no duplicates), and one
 *  user can never produce another user's booking ID. */
export function deriveBookingId(creatorUid: string, requestKey: string): string {
  return `bk_${createHash("sha256").update(`${creatorUid}\n${requestKey}`).digest("hex").slice(0, 24)}`;
}

interface NewBooking {
  input: BookingRequestInput;
  customerId: string | null;
  email: string | null;
  createdBy: BookingRecord["createdBy"];
  source: BookingSource;
  status: "pending" | "confirmed";
  enforceOpenRequestLimit: boolean;
  /** Staff-entered bookings are audited (Phase 5). */
  actor?: AdminActor;
}

function buildRecord(b: NewBooking, hall: HallConfig, now: Date, config: BusinessConfig) {
  const slot = getSlot(config, b.input.slotId);
  const eventType = getEventType(config, b.input.eventTypeId);
  const services = b.input.serviceIds.map((id) => getService(config, id));
  const pkg = b.input.packageId ? getPackage(config, b.input.packageId) : null;
  const menuId = pkg?.menuId ?? b.input.menuPreferenceId;
  const menu = menuId ? getMenu(config, menuId) : null;
  if (!slot || !eventType || services.some((s) => !s) || (menuId && !menu) || (b.input.packageId && !pkg)) return null;

  const priced = quote(
    config,
    { hallId: hall.id, guestCount: b.input.guestCount, serviceIds: b.input.serviceIds, menuId: menu?.id ?? null, packageId: pkg?.id ?? null },
    now
  );
  const snapshot = priced.status === "priced" ? priced.snapshot : null;

  const record: BookingRecord = {
    schemaVersion: BOOKING_SCHEMA_VERSION,
    bookingId: deriveBookingId(b.createdBy.uid, b.input.requestKey),
    customerId: b.customerId,
    customer: { name: b.input.contactName, phone: b.input.contactPhone, email: b.email },
    createdBy: b.createdBy,
    source: b.source,
    eventDate: b.input.date,
    hallId: hall.id,
    hallName: hall.name,
    slotId: slot.id,
    slotLabel: slot.label,
    slotKey: slotKey(b.input.date, hall.id, slot.id),
    eventTypeId: eventType.id,
    eventTypeLabel: eventType.name,
    guestCount: b.input.guestCount,
    services: services.map((s) => ({ id: s!.id, label: s!.name })),
    menuPreference: menu ? { id: menu.id, title: menu.name } : null,
    package: pkg ? { id: pkg.id, name: pkg.name, serviceIds: [...pkg.serviceIds] } : null,
    pricing: snapshot,
    payment: {
      currency: "PKR",
      advanceRequired: snapshot?.advanceRequired ?? null,
      advanceReceived: 0,
      balanceDue: snapshot?.total ?? null,
    },
    status: b.status,
    holdExpiresAt: b.status === "pending" ? new Date(now.getTime() + config.rules.pendingHoldHours * 3_600_000) : null,
    customerNotes: b.input.customerNotes,
    adminNotes: "",
    timeline: b.status === "confirmed" ? { submittedAt: now, confirmedAt: now } : { submittedAt: now },
    createdAt: now,
    updatedAt: now,
  };
  return record;
}

export function lockFor(
  record: Pick<BookingRecord, "slotKey" | "eventDate" | "hallId" | "slotId" | "bookingId" | "status" | "holdExpiresAt">,
  now: Date
): SlotLock {
  return {
    slotKey: record.slotKey,
    date: record.eventDate,
    hallId: record.hallId,
    slotId: record.slotId,
    bookingId: record.bookingId,
    status: record.status,
    holdExpiresAt: record.holdExpiresAt,
    updatedAt: now,
  };
}

async function createBooking(store: BookingStore, b: NewBooking, options: EngineOptions): Promise<CreateResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  const hall = getHall(config, b.input.hallId);
  const today = businessToday(now);
  // Re-checked here so no caller can skip it (the API validates first as well):
  // date rules and the CONFIGURED capacity / minimum guests.
  if (!hall || eventDateError(config, b.input.date, today)) return { ok: false, code: "invalid_request" };
  if (guestCountError(config, hall.id, b.input.guestCount)) return { ok: false, code: "invalid_request" };
  const record = buildRecord(b, hall, now, config);
  if (!record) return { ok: false, code: "invalid_request" };

  return store.runTransaction(async (tx): Promise<CreateResult> => {
    // --- reads ---
    const existing = await tx.getBooking(record.bookingId);
    if (existing) return { ok: true, duplicate: true, booking: existing.data };

    const lock = await tx.getLock(record.slotKey);
    if (lock && lockIsActive(lock.data, now)) return { ok: false, code: "slot_unavailable" };
    // An expired pending hold: its request is marked expired as the slot is taken over.
    const displaced = lock ? await tx.getBooking(lock.data.bookingId) : null;

    if (b.enforceOpenRequestLimit && b.customerId) {
      const open = await tx.listCustomerBookings(b.customerId, OPEN_REQUEST_STATUSES);
      const stillOpen = open.filter((o) => lockIsActive(o, now)).length;
      if (stillOpen >= config.rules.maxOpenRequestsPerCustomer) return { ok: false, code: "too_many_open_requests" };
    }

    // --- writes ---
    tx.createBooking(record);
    if (displaced && displaced.data.status === "pending") {
      tx.updateBooking(
        displaced.data.bookingId,
        { status: "expired", holdExpiresAt: null, updatedAt: now, timeline: { ...displaced.data.timeline, expiredAt: now } },
        displaced.version
      );
      notifyInTransaction(tx, { type: "BOOKING_EXPIRED" }, displaced.data, now);
    }
    // Phase 9: the customer's in-app notification, committed with the booking.
    notifyInTransaction(
      tx,
      { type: record.createdBy.kind === "customer" ? "BOOKING_SUBMITTED" : record.status === "confirmed" ? "BOOKING_CONFIRMED" : "BOOKING_CREATED_BY_STAFF" },
      record,
      now
    );
    if (lock) tx.replaceLock(lockFor(record, now), lock.version);
    else tx.createLock(lockFor(record, now));
    if (b.actor) {
      tx.createAudit(
        auditRecord("booking_created_manual", b.actor, record.bookingId, now, {
          after: { eventDate: record.eventDate, slotId: record.slotId, status: record.status, source: record.source },
        })
      );
    }
    return { ok: true, duplicate: false, booking: record };
  });
}

/** A signed-in customer's request from the website. Identity comes only from
 *  the verified session, never from the request body. */
export function createCustomerBookingRequest(
  store: BookingStore,
  customer: { uid: string; email: string | null },
  input: BookingRequestInput,
  options: EngineOptions = {}
): Promise<CreateResult> {
  return createBooking(
    store,
    {
      input,
      customerId: customer.uid,
      email: customer.email,
      createdBy: { kind: "customer", uid: customer.uid },
      source: "website",
      status: "pending",
      enforceOpenRequestLimit: true,
    },
    options
  );
}

/** A walk-in / WhatsApp / phone / other booking entered by venue staff, through
 *  the SAME transaction and slot locks as website requests (never bypassed).
 *  Callers must have verified that `admin` is a Super Admin. */
export function createManualBooking(
  store: BookingStore,
  admin: { uid: string; email?: string | null },
  input: BookingRequestInput & {
    source: Exclude<BookingSource, "website">;
    status: "pending" | "confirmed";
    customerId?: string | null;
    email?: string | null;
  },
  options: EngineOptions = {}
): Promise<CreateResult> {
  return createBooking(
    store,
    {
      input,
      customerId: input.customerId ?? null,
      email: input.email ?? null,
      createdBy: { kind: "admin", uid: admin.uid },
      source: input.source,
      status: input.status,
      enforceOpenRequestLimit: false,
      actor: { uid: admin.uid, email: admin.email ?? null },
    },
    options
  );
}

export type StatusChangeResult =
  | { ok: true; booking: BookingRecord }
  | { ok: false; code: "not_found" | "invalid_transition" | "slot_unavailable" | "stale" };

export interface StatusChangeOptions extends EngineOptions {
  /** Admin making the change: an audit record is written with it. */
  actor?: AdminActor;
  reason?: string;
  /** The booking's updatedAt as the admin saw it; a different value = stale page. */
  expectedUpdatedAt?: string;
}

const STATUS_AUDIT: Partial<Record<BookingStatus, AuditAction>> = {
  under_review: "booking_under_review",
  confirmed: "booking_confirmed",
  rejected: "booking_rejected",
  cancelled: "booking_cancelled",
  completed: "booking_completed",
};

/**
 * Moves a booking to a new status and keeps its slot lock in step, atomically:
 *  - holding statuses re-check the slot NOW: the lock must belong to this
 *    booking, be free, or be an expired hold of another request (which is then
 *    marked expired); otherwise "slot_unavailable" and nothing changes;
 *  - releasing statuses delete the lock and close the booking's open requests.
 * For admin tools and scheduled jobs only; there is no customer API for it.
 */
export async function changeBookingStatus(
  store: BookingStore,
  bookingId: string,
  to: BookingStatus,
  options: StatusChangeOptions = {}
): Promise<StatusChangeResult> {
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx: BookingTransaction): Promise<StatusChangeResult> => {
    // --- reads ---
    const current = await tx.getBooking(bookingId);
    if (!current) return { ok: false, code: "not_found" };
    const booking = current.data;
    if (options.expectedUpdatedAt && new Date(booking.updatedAt).toISOString() !== options.expectedUpdatedAt) {
      return { ok: false, code: "stale" };
    }
    if (!canTransition(booking.status, to)) return { ok: false, code: "invalid_transition" };
    const lock = await tx.getLock(booking.slotKey);
    const ownsLock = lock !== null && lock.data.bookingId === bookingId;
    const holding = holdsSlot(to);
    let displaced: Awaited<ReturnType<BookingTransaction["getBooking"]>> = null;
    if (holding && lock && !ownsLock) {
      if (lockIsActive(lock.data, now)) return { ok: false, code: "slot_unavailable" };
      displaced = await tx.getBooking(lock.data.bookingId);
    }
    const openRequests = holding ? [] : await tx.listOpenRequestsForBooking(bookingId);

    const updated: BookingRecord = {
      ...booking,
      status: to,
      holdExpiresAt: to === "pending" ? booking.holdExpiresAt : null,
      updatedAt: now,
      timeline: { ...booking.timeline, [TIMELINE_KEY[to]]: now },
    };
    const patch: Partial<BookingRecord> = {
      status: updated.status,
      holdExpiresAt: updated.holdExpiresAt,
      updatedAt: now,
      timeline: updated.timeline,
    };

    // --- writes ---
    tx.updateBooking(bookingId, patch, current.version);
    if (holding) {
      if (!lock) tx.createLock(lockFor(updated, now));
      else tx.replaceLock(lockFor(updated, now), lock.version);
      if (displaced && displaced.data.status === "pending") {
        tx.updateBooking(
          displaced.data.bookingId,
          { status: "expired", holdExpiresAt: null, updatedAt: now, timeline: { ...displaced.data.timeline, expiredAt: now } },
          displaced.version
        );
        notifyInTransaction(tx, { type: "BOOKING_EXPIRED" }, displaced.data, now);
      }
    } else {
      if (ownsLock) tx.deleteLock(booking.slotKey, lock!.version);
      for (const r of openRequests) {
        tx.updateRequest(r.requestId, {
          status: "declined",
          decidedAt: now,
          updatedAt: now,
          decidedBy: options.actor ? { uid: options.actor.uid } : null,
          decisionReason: `Booking ${to}`,
        });
      }
    }
    const notification = STATUS_NOTIFICATION[to];
    if (notification) notifyInTransaction(tx, { type: notification } as never, updated, now);
    const action = STATUS_AUDIT[to];
    if (options.actor && action) {
      tx.createAudit(
        auditRecord(action, options.actor, bookingId, now, {
          before: { status: booking.status },
          after: { status: to },
          reason: options.reason ?? "",
        })
      );
    }
    return { ok: true, booking: updated };
  });
}

export const MAX_AVAILABILITY_DAYS = 62;

export type AvailabilityResult =
  | { ok: true; availability: AvailabilityResponse }
  | { ok: false; code: "invalid_hall" | "invalid_range" };

/** Availability for one hall over a date range, from one indexed query. */
export async function getAvailability(
  store: BookingStore,
  hallId: string,
  from: string,
  to: string,
  options: EngineOptions = {}
): Promise<AvailabilityResult> {
  const now = options.now ?? new Date();
  const config = options.config ?? DEFAULT_CONFIG;
  const hall = getHall(config, hallId);
  if (!hall) return { ok: false, code: "invalid_hall" };
  if (!isIsoDate(from) || !isIsoDate(to) || to < from || daysBetween(from, to) >= MAX_AVAILABILITY_DAYS) {
    return { ok: false, code: "invalid_range" };
  }
  const today = businessToday(now);
  const locks = await store.listLocks(hall.id, from, to);
  return {
    ok: true,
    availability: {
      hallId: hall.id,
      today,
      days: buildAvailability(config, hall.id, from, to, locks, now, today),
    },
  };
}

