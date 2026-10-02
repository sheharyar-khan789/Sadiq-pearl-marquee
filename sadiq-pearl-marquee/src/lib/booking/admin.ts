// Super Admin booking operations (Phase 5) — SERVER ONLY in use.
// Every function here expects the caller (an API route) to have verified the
// Super Admin from the session already; `actor` is that verified identity and
// is written to the audit trail in the same transaction as each change.
import { DEFAULT_CONFIG, getHall, getMenu, getService, getSlot, type BusinessConfig } from "../config/business-config.ts";
import { businessToday } from "./dates.ts";
import { auditRecord, changeBookingStatus, lockFor, type StatusChangeResult } from "./engine.ts";
import { BOOKING_SOURCES, lockIsActive, slotKey, type BookingRecord, type BookingSource } from "./model.ts";
import { quote } from "./pricing.ts";
import type { AdminActor } from "./audit-model.ts";
import type { BookingRequestRecord } from "./request-model.ts";
import type { BookingStatus } from "./status.ts";
import type { BookingStore, BookingTransaction } from "./store.ts";
import { notifyInTransaction } from "./notifications.ts";
import { eventDateError, guestCountError, validateBookingRequest, type BookingRequestInput, type FieldErrors } from "./validation.ts";

// ------------------------------------------------------------ status actions

/** Status changes an admin may make from the panel ("expired" is system-only). */
export const ADMIN_STATUS_ACTIONS = ["under_review", "confirmed", "rejected", "cancelled", "completed"] as const;
export type AdminStatusAction = (typeof ADMIN_STATUS_ACTIONS)[number];

export type AdminStatusResult = StatusChangeResult | { ok: false; code: "invalid_action" | "event_not_over" };

export async function adminSetStatus(
  store: BookingStore,
  actor: AdminActor,
  bookingId: string,
  to: unknown,
  options: { reason?: string; expectedUpdatedAt?: string; now?: Date } = {}
): Promise<AdminStatusResult> {
  if (!(ADMIN_STATUS_ACTIONS as readonly unknown[]).includes(to)) return { ok: false, code: "invalid_action" };
  const now = options.now ?? new Date();
  if (to === "completed") {
    // An event can only be marked completed on or after its date.
    const booking = await store.getBooking(bookingId);
    if (booking && booking.eventDate > businessToday(now)) return { ok: false, code: "event_not_over" };
  }
  return changeBookingStatus(store, bookingId, to as BookingStatus, {
    now,
    actor,
    reason: (options.reason ?? "").slice(0, 1000),
    expectedUpdatedAt: options.expectedUpdatedAt,
  });
}

// ---------------------------------------------------------------- admin notes

export const ADMIN_NOTES_MAX = 4000;

export async function adminUpdateNotes(
  store: BookingStore,
  actor: AdminActor,
  bookingId: string,
  notes: string,
  options: { expectedUpdatedAt?: string; now?: Date } = {}
): Promise<{ ok: true } | { ok: false; code: "not_found" | "stale" | "invalid_notes" }> {
  if (typeof notes !== "string" || notes.length > ADMIN_NOTES_MAX) return { ok: false, code: "invalid_notes" };
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx) => {
    const current = await tx.getBooking(bookingId);
    if (!current) return { ok: false as const, code: "not_found" as const };
    if (options.expectedUpdatedAt && new Date(current.data.updatedAt).toISOString() !== options.expectedUpdatedAt) {
      return { ok: false as const, code: "stale" as const };
    }
    tx.updateBooking(bookingId, { adminNotes: notes.trim(), updatedAt: now }, current.version);
    tx.createAudit(
      auditRecord("admin_notes_updated", actor, bookingId, now, {
        before: { adminNotesLength: current.data.adminNotes.length },
        after: { adminNotesLength: notes.trim().length },
      })
    );
    return { ok: true as const };
  });
}

// ------------------------------------------------------------- manual booking

export interface ManualBookingInput extends BookingRequestInput {
  source: Exclude<BookingSource, "website">;
  status: "pending" | "confirmed";
  /** Existing online account to attach the booking to (optional). */
  customerId: string | null;
  email: string | null;
}

const MANUAL_EXTRA = new Set(["source", "status", "customerId", "email"]);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same validation as website requests, plus the staff-only fields. */
export function validateManualBooking(
  raw: unknown,
  today: string,
  config: BusinessConfig
): { ok: true; value: ManualBookingInput } | { ok: false; errors: FieldErrors & Record<string, { code: string; message: string }> } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const core = Object.fromEntries(Object.entries(body).filter(([k]) => !MANUAL_EXTRA.has(k)));
  const base = validateBookingRequest(core, today, config);
  const errors: Record<string, { code: string; message: string }> = base.ok ? {} : { ...base.errors };

  const source = body.source;
  if (!(BOOKING_SOURCES as readonly unknown[]).includes(source) || source === "website") {
    errors.source = { code: "invalid_source", message: "Choose walk-in, WhatsApp, phone or other." };
  }
  if (body.status !== "pending" && body.status !== "confirmed") {
    errors.status = { code: "invalid_status", message: "Choose pending or confirmed." };
  }
  const customerId = body.customerId ?? null;
  if (customerId !== null && (typeof customerId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(customerId))) {
    errors.customerId = { code: "invalid_customer", message: "Unknown customer." };
  }
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  if (body.email !== undefined && body.email !== null && body.email !== "" && (!email || !EMAIL.test(email))) {
    errors.email = { code: "invalid_email", message: "Please enter a valid email, or leave it empty." };
  }
  if (!base.ok || Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...base.value,
      source: source as ManualBookingInput["source"],
      status: body.status as ManualBookingInput["status"],
      customerId: customerId as string | null,
      email,
    },
  };
}

// --------------------------------------------------------- request decisions

export type RequestDecision = "approve" | "reject";
export type DecisionResult =
  | { ok: true; request: BookingRequestRecord; booking: BookingRecord }
  | {
      ok: false;
      code:
        | "not_found"
        | "not_open"
        | "not_allowed"
        | "slot_unavailable"
        | "invalid_change"
        | "stale"
        | "invalid_decision"
        | "total_below_paid";
    };

/** Recalculates the price after a change with the CURRENT configuration; with
 *  missing prices it becomes "pending" (null). The advance already received is kept. */
function repriced(b: BookingRecord, now: Date, config: BusinessConfig): Pick<BookingRecord, "pricing" | "payment"> {
  const q = quote(
    config,
    {
      hallId: b.hallId,
      guestCount: b.guestCount,
      serviceIds: b.services.map((s) => s.id),
      menuId: b.menuPreference?.id ?? null,
      packageId: b.package?.id ?? null,
    },
    now
  );
  const snapshot = q.status === "priced" ? q.snapshot : null;
  const received = b.payment?.advanceReceived ?? 0;
  return {
    pricing: snapshot,
    payment: {
      currency: "PKR",
      advanceRequired: snapshot?.advanceRequired ?? null,
      advanceReceived: received,
      balanceDue: snapshot ? snapshot.total - received : null,
    },
  };
}

/**
 * Phase 8: what approving a modification WOULD do to the price, without
 * writing anything (same rules as decideRequest: a price-relevant change is
 * re-priced with the current configuration). Used to flag requests that would
 * need a refund / financial adjustment before an admin tries to approve them.
 */
export function projectModificationPrice(
  b: BookingRecord,
  changes: NonNullable<BookingRequestRecord["changes"]>,
  config: BusinessConfig,
  now: Date
): { repriced: false } | { repriced: true; total: number | null } {
  const moving =
    (changes.eventDate !== undefined && changes.eventDate !== b.eventDate) ||
    (changes.slotId !== undefined && changes.slotId !== b.slotId);
  const priceRelevant =
    changes.guestCount !== undefined || changes.serviceIds !== undefined || changes.menuPreferenceId !== undefined || moving;
  if (!priceRelevant) return { repriced: false };
  const menuId = changes.menuPreferenceId === undefined ? (b.menuPreference?.id ?? null) : changes.menuPreferenceId || null;
  const q = quote(
    config,
    {
      hallId: b.hallId,
      guestCount: changes.guestCount ?? b.guestCount,
      serviceIds: changes.serviceIds ?? b.services.map((s) => s.id),
      menuId,
      packageId: b.package?.id ?? null,
    },
    now
  );
  return { repriced: true, total: q.status === "priced" ? q.snapshot.total : null };
}

/**
 * Approves or rejects a customer's modification / cancellation request in ONE
 * transaction. For a modification that moves the date or slot, the new slot
 * is claimed, the booking updated, the old slot released and the request
 * closed together; if the new slot is taken, NOTHING changes.
 */
export async function decideRequest(
  store: BookingStore,
  actor: AdminActor,
  requestId: string,
  decision: unknown,
  options: { reason?: string; expectedBookingUpdatedAt?: string; now?: Date; config?: BusinessConfig } = {}
): Promise<DecisionResult> {
  if (decision !== "approve" && decision !== "reject") return { ok: false, code: "invalid_decision" };
  const now = options.now ?? new Date();
  const today = businessToday(now);
  const reason = (options.reason ?? "").slice(0, 1000);
  const config = options.config ?? DEFAULT_CONFIG;

  return store.runTransaction(async (tx: BookingTransaction): Promise<DecisionResult> => {
    // --- reads ---
    const req = await tx.getRequest(requestId);
    if (!req) return { ok: false, code: "not_found" };
    const request = req.data;
    if (request.status !== "open") return { ok: false, code: "not_open" };
    const found = await tx.getBooking(request.bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const booking = found.data;
    if (options.expectedBookingUpdatedAt && new Date(booking.updatedAt).toISOString() !== options.expectedBookingUpdatedAt) {
      return { ok: false, code: "stale" };
    }
    const closed = {
      decidedAt: now,
      updatedAt: now,
      decidedBy: { uid: actor.uid },
      decisionReason: reason,
    };

    if (decision === "reject") {
      tx.updateRequest(requestId, { status: "declined", ...closed });
      notifyInTransaction(tx, { type: request.type === "cancellation" ? "CANCELLATION_REJECTED" : "MODIFICATION_REJECTED", requestId }, booking, now);
      tx.createAudit(
        auditRecord(request.type === "cancellation" ? "cancellation_rejected" : "modification_rejected", actor, booking.bookingId, now, {
          requestId,
          reason,
        })
      );
      return { ok: true, request: { ...request, status: "declined", ...closed }, booking };
    }

    const active = booking.status === "pending" || booking.status === "under_review" || booking.status === "confirmed";
    if (!active) return { ok: false, code: "not_allowed" };

    // ----- cancellation: cancel the booking, release its slot, close other open requests
    if (request.type === "cancellation") {
      const lock = await tx.getLock(booking.slotKey);
      const others = (await tx.listOpenRequestsForBooking(booking.bookingId)).filter((r) => r.requestId !== requestId);
      tx.updateBooking(
        booking.bookingId,
        { status: "cancelled", holdExpiresAt: null, updatedAt: now, timeline: { ...booking.timeline, cancelledAt: now } },
        found.version
      );
      if (lock && lock.data.bookingId === booking.bookingId) tx.deleteLock(booking.slotKey, lock.version);
      tx.updateRequest(requestId, { status: "accepted", ...closed });
      notifyInTransaction(tx, { type: "CANCELLATION_APPROVED", requestId }, booking, now);
      for (const r of others) {
        tx.updateRequest(r.requestId, { status: "declined", ...closed, decisionReason: "Booking cancelled" });
      }
      tx.createAudit(
        auditRecord("cancellation_approved", actor, booking.bookingId, now, {
          requestId,
          before: { status: booking.status },
          after: { status: "cancelled" },
          reason,
        })
      );
      const updated = { ...booking, status: "cancelled" as const, holdExpiresAt: null, updatedAt: now };
      return { ok: true, request: { ...request, status: "accepted", ...closed }, booking: updated };
    }

    // ----- modification
    const c = request.changes ?? {};
    // Re-validated against the CURRENT configuration at approval time.
    const hall = getHall(config, booking.hallId);
    const newDate = c.eventDate ?? booking.eventDate;
    const newSlot = c.slotId || c.eventDate ? getSlot(config, c.slotId ?? booking.slotId) : { id: booking.slotId, label: booking.slotLabel };
    const guests = c.guestCount ?? booking.guestCount;
    const services = c.serviceIds ? c.serviceIds.map((id) => getService(config, id)) : null;
    const newMenu = c.menuPreferenceId ? getMenu(config, c.menuPreferenceId) : null;
    const menu = c.menuPreferenceId === undefined ? booking.menuPreference : newMenu ? { id: newMenu.id, title: newMenu.name } : null;
    if (
      !hall ||
      !newSlot ||
      (c.eventDate !== undefined && eventDateError(config, newDate, today)) ||
      (c.guestCount !== undefined && guestCountError(config, hall.id, guests)) ||
      (services && services.some((s) => !s)) ||
      (c.menuPreferenceId && !newMenu)
    ) {
      return { ok: false, code: "invalid_change" };
    }

    const newKey = slotKey(newDate, hall.id, newSlot.id);
    const moving = newKey !== booking.slotKey;
    const oldLock = await tx.getLock(booking.slotKey);
    const newLock = moving ? await tx.getLock(newKey) : null;
    let displaced: Awaited<ReturnType<BookingTransaction["getBooking"]>> = null;
    if (newLock && newLock.data.bookingId !== booking.bookingId) {
      if (lockIsActive(newLock.data, now)) return { ok: false, code: "slot_unavailable" };
      displaced = await tx.getBooking(newLock.data.bookingId);
    }

    const extraNotes = [
      c.decorationPreference ? `Decoration preference: ${c.decorationPreference}` : "",
      c.notes ? `Change request note: ${c.notes}` : "",
    ].filter(Boolean);
    const priceRelevant =
      c.guestCount !== undefined || c.serviceIds !== undefined || c.menuPreferenceId !== undefined || moving;
    let updated: BookingRecord = {
      ...booking,
      eventDate: newDate,
      slotId: newSlot.id,
      slotLabel: newSlot.label,
      slotKey: newKey,
      guestCount: guests,
      services: services ? services.map((s) => ({ id: s!.id, label: s!.name })) : booking.services,
      menuPreference: menu ? { id: menu.id, title: menu.title } : null,
      customerNotes: [booking.customerNotes, ...extraNotes].filter(Boolean).join("\n").slice(0, 3000),
      // A pending request moved by staff gets a fresh hold (same configured policy)
      // so its new slot is actually held while the team finishes reviewing it.
      holdExpiresAt:
        booking.status === "pending" && moving
          ? new Date(now.getTime() + config.rules.pendingHoldHours * 3_600_000)
          : booking.holdExpiresAt,
      updatedAt: now,
    };
    if (priceRelevant) updated = { ...updated, ...repriced(updated, now, config) };
    // Phase 7: a change may not lower the price below what was already paid
    // (refunds are handled outside the system; the admin must void/adjust first).
    if (updated.pricing && updated.pricing.total < updated.payment.advanceReceived) return { ok: false, code: "total_below_paid" };

    // --- writes (all or nothing) ---
    const { bookingId, schemaVersion, createdAt, createdBy, customerId, ...patch } = updated;
    void bookingId; void schemaVersion; void createdAt; void createdBy; void customerId;
    tx.updateBooking(booking.bookingId, patch, found.version);
    if (moving) {
      if (newLock) tx.replaceLock(lockFor(updated, now), newLock.version);
      else tx.createLock(lockFor(updated, now));
      if (oldLock && oldLock.data.bookingId === booking.bookingId) tx.deleteLock(booking.slotKey, oldLock.version);
      if (displaced && displaced.data.status === "pending") {
        tx.updateBooking(
          displaced.data.bookingId,
          { status: "expired", holdExpiresAt: null, updatedAt: now, timeline: { ...displaced.data.timeline, expiredAt: now } },
          displaced.version
        );
        notifyInTransaction(tx, { type: "BOOKING_EXPIRED" }, displaced.data, now);
      }
    }
    tx.updateRequest(requestId, { status: "accepted", ...closed });
    notifyInTransaction(tx, { type: "MODIFICATION_APPROVED", requestId, previous: { eventDate: booking.eventDate, slotLabel: booking.slotLabel } }, updated, now);
    tx.createAudit(
      auditRecord("modification_approved", actor, booking.bookingId, now, {
        requestId,
        before: {
          eventDate: booking.eventDate,
          slotId: booking.slotId,
          guestCount: booking.guestCount,
          menuPreferenceId: booking.menuPreference?.id ?? null,
          priced: booking.pricing !== null,
        },
        after: {
          eventDate: updated.eventDate,
          slotId: updated.slotId,
          guestCount: updated.guestCount,
          menuPreferenceId: updated.menuPreference?.id ?? null,
          priced: updated.pricing !== null,
        },
        reason,
      })
    );
    return { ok: true, request: { ...request, status: "accepted", ...closed }, booking: updated };
  });
}
