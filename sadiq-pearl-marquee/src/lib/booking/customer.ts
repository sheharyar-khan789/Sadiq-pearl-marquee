// Customer data access and change requests (Phase 4) — SERVER ONLY in use
// (API routes and server components). Every function takes the customer's
// uid from the verified session; nothing here accepts a uid from a browser.
//
// Ownership rule: a booking is returned only if booking.customerId equals
// the session uid. "Not yours" and "doesn't exist" give the same answer, so
// booking IDs of other customers cannot be discovered.
import { createHash } from "node:crypto";
import { getMenu, getService, getSlot, type BusinessConfig, type SlotId } from "../config/business-config.ts";
import { slotStateFor } from "./availability.ts";
import { businessToday } from "./dates.ts";
import { slotKey, type BookingRecord } from "./model.ts";
import { canRequestChanges } from "./portal.ts";
import {
  REQUEST_SCHEMA_VERSION,
  type BookingRequestRecord,
  type BookingRequestType,
  type RequestedChanges,
} from "./request-model.ts";
import type { BookingStore } from "./store.ts";
import { eventDateError, guestCountError, type FieldErrors } from "./validation.ts";
import { notifyInTransaction } from "./notifications.ts";

export const BOOKING_ID_PATTERN = /^bk_[0-9a-f]{24}$/;
export const MAX_CUSTOMER_BOOKINGS = 200;

/** The customer's own booking, or null (missing OR someone else's). */
export async function getOwnBooking(store: BookingStore, uid: string, bookingId: string): Promise<BookingRecord | null> {
  if (!uid || typeof bookingId !== "string" || !BOOKING_ID_PATTERN.test(bookingId)) return null;
  const booking = await store.getBooking(bookingId);
  return booking && booking.customerId === uid ? booking : null;
}

/** All of the customer's bookings: one query scoped to their uid. */
export async function listOwnBookings(store: BookingStore, uid: string): Promise<BookingRecord[]> {
  if (!uid) return [];
  const list = await store.listBookingsForCustomer(uid, MAX_CUSTOMER_BOOKINGS);
  return list.filter((b) => b.customerId === uid); // defence in depth
}

export async function listOwnRequests(
  store: BookingStore,
  uid: string,
  filter: { bookingId?: string; openOnly?: boolean } = {}
): Promise<BookingRequestRecord[]> {
  if (!uid) return [];
  const list = await store.listRequestsForCustomer(uid, filter);
  return list.filter((r) => r.customerId === uid).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

// ------------------------------------------------------------------ requests

export interface ChangeRequestInput {
  type: BookingRequestType;
  changes: RequestedChanges | null;
  reason: string;
  requestKey: string;
}

const REQUEST_KEY = /^[A-Za-z0-9_-]{16,80}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const TEXT_MAX = 1000;
const DECOR_MAX = 500;
const TOP_FIELDS = new Set(["type", "changes", "reason", "requestKey"]);
const CHANGE_FIELDS = new Set(["eventDate", "slotId", "guestCount", "serviceIds", "menuPreferenceId", "decorationPreference", "notes"]);

const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max && !CONTROL.test(v);

/** Shape validation of a change request (the booking is checked in the transaction). */
export function validateChangeRequest(
  raw: unknown,
  today: string,
  config: BusinessConfig,
  hallId = "main-hall"
): { ok: true; value: ChangeRequestInput } | { ok: false; errors: FieldErrors & Record<string, { code: string; message: string }> } {
  const errors: Record<string, { code: string; message: string }> = {};
  const fail = (field: string, code: string, message: string) => void (errors[field] ??= { code, message });
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((k) => !TOP_FIELDS.has(k));
  if (unexpected.length) fail("body", "unexpected_field", `Unexpected field(s): ${unexpected.join(", ")}.`);

  const type = body.type;
  if (type !== "modification" && type !== "cancellation") fail("type", "invalid_type", "Unknown request type.");
  if (typeof body.requestKey !== "string" || !REQUEST_KEY.test(body.requestKey)) {
    fail("requestKey", "invalid_request_key", "Please reload the page and try again.");
  }
  const reason = body.reason ?? "";
  if (!text(reason, TEXT_MAX)) fail("reason", "invalid_reason", `Please keep this under ${TEXT_MAX} characters.`);

  let changes: RequestedChanges | null = null;
  if (type === "cancellation") {
    if (body.changes !== undefined && body.changes !== null) fail("changes", "unexpected_changes", "A cancellation has no changes.");
  } else if (type === "modification") {
    const c = body.changes;
    if (typeof c !== "object" || c === null || Array.isArray(c)) {
      fail("changes", "no_changes", "Please tell us what you would like to change.");
    } else {
      const input = c as Record<string, unknown>;
      const extra = Object.keys(input).filter((k) => !CHANGE_FIELDS.has(k));
      if (extra.length) fail("body", "unexpected_field", `Unexpected field(s): ${extra.join(", ")}.`);
      changes = {};
      // The admin's modification policy decides which changes can be requested.
      const allowed = config.rules.modifications;
      const blocked = (field: string, message: string) => fail(field, "change_not_allowed", message);
      if (input.eventDate !== undefined) {
        const e = allowed.date ? eventDateError(config, input.eventDate, today) : null;
        if (!allowed.date) blocked("eventDate", "Date changes can't be requested online. Please contact us.");
        else if (e) fail("eventDate", e.code, e.message);
        else changes.eventDate = input.eventDate as string;
      }
      if (input.slotId !== undefined) {
        if (!allowed.slot) blocked("slotId", "Slot changes can't be requested online. Please contact us.");
        else if (!getSlot(config, input.slotId)) fail("slotId", "invalid_slot", "Please choose an available slot.");
        else changes.slotId = input.slotId as SlotId;
      }
      if (input.guestCount !== undefined) {
        const e = allowed.guestCount ? guestCountError(config, hallId, input.guestCount) : null;
        if (!allowed.guestCount) blocked("guestCount", "Guest-count changes can't be requested online. Please contact us.");
        else if (e) fail("guestCount", e.code, e.message);
        else changes.guestCount = input.guestCount as number;
      }
      if (input.serviceIds !== undefined) {
        const s = input.serviceIds;
        if (!allowed.services) blocked("serviceIds", "Service changes can't be requested online. Please contact us.");
        else if (!Array.isArray(s) || s.length > 30 || new Set(s).size !== s.length || !s.every((id) => getService(config, id))) {
          fail("serviceIds", "invalid_service", "One of the selected services is not available.");
        } else changes.serviceIds = s as string[];
      }
      if (input.menuPreferenceId !== undefined) {
        const m = input.menuPreferenceId;
        if (!allowed.menu) blocked("menuPreferenceId", "Menu changes can't be requested online. Please contact us.");
        else if (m !== null && !getMenu(config, m)) fail("menuPreferenceId", "invalid_menu", "Please choose a menu from the list.");
        else changes.menuPreferenceId = m as string | null;
      }
      if (input.decorationPreference !== undefined) {
        if (!text(input.decorationPreference, DECOR_MAX)) {
          fail("decorationPreference", "invalid_decoration", `Please keep this under ${DECOR_MAX} characters.`);
        } else if ((input.decorationPreference as string).trim()) changes.decorationPreference = (input.decorationPreference as string).trim();
      }
      if (input.notes !== undefined) {
        if (!text(input.notes, TEXT_MAX)) fail("notes", "invalid_notes", `Please keep this under ${TEXT_MAX} characters.`);
        else if ((input.notes as string).trim()) changes.notes = (input.notes as string).trim();
      }
      if (!Object.keys(errors).length && !Object.keys(changes).length) {
        fail("changes", "no_changes", "Please tell us what you would like to change.");
      }
    }
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      type: type as BookingRequestType,
      changes,
      reason: (reason as string).trim(),
      requestKey: body.requestKey as string,
    },
  };
}

export function deriveRequestId(uid: string, requestKey: string): string {
  return `rq_${createHash("sha256").update(`${uid}\nrequest\n${requestKey}`).digest("hex").slice(0, 24)}`;
}

export type ChangeRequestResult =
  | { ok: true; duplicate: boolean; request: BookingRequestRecord }
  | { ok: false; code: "not_found" | "not_allowed" | "request_exists" | "no_changes" };

/** Drops requested values that equal the booking's current ones. */
function effectiveChanges(c: RequestedChanges, b: BookingRecord): RequestedChanges {
  const out: RequestedChanges = {};
  if (c.eventDate !== undefined && c.eventDate !== b.eventDate) out.eventDate = c.eventDate;
  if (c.slotId !== undefined && c.slotId !== b.slotId) out.slotId = c.slotId;
  if (c.guestCount !== undefined && c.guestCount !== b.guestCount) out.guestCount = c.guestCount;
  const current = (b.services ?? []).map((s) => s.id).sort().join(",");
  if (c.serviceIds !== undefined && [...c.serviceIds].sort().join(",") !== current) out.serviceIds = c.serviceIds;
  if (c.menuPreferenceId !== undefined && c.menuPreferenceId !== (b.menuPreference?.id ?? null)) {
    out.menuPreferenceId = c.menuPreferenceId;
  }
  if (c.decorationPreference) out.decorationPreference = c.decorationPreference;
  if (c.notes) out.notes = c.notes;
  return out;
}

/**
 * Records a modification or cancellation request for the customer's own
 * booking. It never changes the booking or any slot lock; a requested new
 * date/slot is only checked (and its state recorded) for the venue team.
 */
export async function submitChangeRequest(
  store: BookingStore,
  customer: { uid: string },
  bookingId: string,
  input: ChangeRequestInput,
  options: { now?: Date } = {}
): Promise<ChangeRequestResult> {
  const now = options.now ?? new Date();
  if (!customer.uid || !BOOKING_ID_PATTERN.test(bookingId)) return { ok: false, code: "not_found" };
  const requestId = deriveRequestId(customer.uid, input.requestKey);
  const today = businessToday(now);

  return store.runTransaction(async (tx): Promise<ChangeRequestResult> => {
    // --- reads ---
    const existing = await tx.getRequest(requestId);
    if (existing) {
      // Same customer + same key = the same submission sent again.
      return existing.data.bookingId === bookingId && existing.data.customerId === customer.uid
        ? { ok: true, duplicate: true, request: existing.data }
        : { ok: false, code: "not_found" };
    }
    const found = await tx.getBooking(bookingId);
    if (!found || found.data.customerId !== customer.uid) return { ok: false, code: "not_found" };
    const booking = found.data;
    if (!canRequestChanges(booking, today)) return { ok: false, code: "not_allowed" };

    const open = await tx.listOpenRequestsForBooking(bookingId);
    if (open.some((r) => r.type === input.type) || (input.type === "modification" && open.some((r) => r.type === "cancellation"))) {
      return { ok: false, code: "request_exists" };
    }

    let changes: RequestedChanges | null = null;
    let requestedSlot: BookingRequestRecord["requestedSlot"] = null;
    if (input.type === "modification") {
      changes = effectiveChanges(input.changes ?? {}, booking);
      if (!Object.keys(changes).length) return { ok: false, code: "no_changes" };
      if (changes.eventDate || changes.slotId) {
        const key = slotKey(changes.eventDate ?? booking.eventDate, booking.hallId, changes.slotId ?? booking.slotId);
        const lock = await tx.getLock(key); // read only: nothing is reserved
        requestedSlot = { slotKey: key, stateAtRequest: slotStateFor(lock?.data, now) };
      }
    }

    // --- write (the request only) ---
    const request: BookingRequestRecord = {
      schemaVersion: REQUEST_SCHEMA_VERSION,
      requestId,
      bookingId,
      customerId: customer.uid,
      type: input.type,
      status: "open",
      changes,
      requestedSlot,
      reason: input.type === "cancellation" ? input.reason : "",
      bookingSnapshot: {
        eventDate: booking.eventDate,
        slotId: booking.slotId,
        guestCount: booking.guestCount,
        menuPreferenceId: booking.menuPreference?.id ?? null,
        status: booking.status,
      },
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
    };
    tx.createRequest(request);
    notifyInTransaction(tx, { type: request.type === "cancellation" ? "CANCELLATION_REQUESTED" : "MODIFICATION_REQUESTED", requestId: request.requestId }, booking, now);
    return { ok: true, duplicate: false, request };
  });
}
