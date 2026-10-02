// Event operations (Phase 8) — SERVER ONLY in use.
//
// Every function expects the caller (an admin API route) to have verified the
// Super Admin; `actor` is that verified identity. Each change runs in ONE
// transaction together with its audit record (adminAudit, same trail as
// bookings and payments).
//
// Boundaries: these functions READ the booking (date, slot, status, selections)
// but never write it, its slot lock, its price or any payment / quotation /
// receipt. They only write eventOperations, vendors and vendorAssignments.
import { createHash, randomUUID } from "node:crypto";
import { auditRecord } from "./engine.ts";
import { businessToday } from "./dates.ts";
import { financialSummary } from "./finance-model.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import {
  CHECKLIST_STATUSES,
  isActiveAssignment,
  isOperationalBooking,
  OPERATIONS_SCHEMA_VERSION,
  OPS_STATUSES,
  bookingChecklist,
  opsTransitionError,
  syncChecklist,
  VENDOR_CATEGORIES,
  type ChecklistLabels,
  type ChecklistStatus,
  type EventOperationsRecord,
  type OpsStatus,
  type VendorAssignmentRecord,
  type VendorCategory,
  type VendorRecord,
} from "./operations-model.ts";
import type { AdminActor, AuditRecord } from "./audit-model.ts";
import type { BookingStore, BookingTransaction, Versioned } from "./store.ts";

type Actor = AdminActor;
const who = (a: Actor) => a.email ?? a.uid;
export const CHECKLIST_LABEL_MAX = 120;
export const CHECKLIST_NOTE_MAX = 500;
export const OPS_NOTE_MAX = 2000;
const MAX_CHECKLIST_ITEMS = 80;
const MAX_NOTES = 200;

const opsAudit = (
  action: AuditRecord["action"],
  actor: Actor,
  bookingId: string,
  now: Date,
  entity: { type: "operations" | "vendor"; id: string },
  extra: { before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; reason?: string } = {}
): AuditRecord => ({ ...auditRecord(action, actor, bookingId, now, extra), entityType: entity.type, entityId: entity.id });

/** A fresh operational record for a booking (not yet saved). */
export function newOperations(b: BookingRecord, labels: ChecklistLabels, now: Date): EventOperationsRecord {
  return {
    schemaVersion: OPERATIONS_SCHEMA_VERSION,
    bookingId: b.bookingId,
    status: "not_started",
    checklist: bookingChecklist(b, labels),
    notes: [],
    completedSnapshot: null,
    createdAt: now,
    updatedAt: now,
  };
}

type OpsFailure =
  | "not_found"
  | "not_operational"
  | "invalid_ops_status"
  | "invalid_ops_transition"
  | "event_not_started"
  | "item_not_found"
  | "note_not_found"
  | "invalid_checklist_status"
  | "invalid_note"
  | "invalid_label"
  | "too_many_items"
  | "nothing_to_sync";
export type OpsResult = { ok: true; operations: EventOperationsRecord } | { ok: false; code: OpsFailure };

/**
 * Reads the booking and its operational record (creating the record in this
 * transaction if it doesn't exist yet: create() fails if another admin created
 * it at the same moment, so the transaction retries instead of duplicating it).
 */
async function withOperations(
  store: BookingStore,
  bookingId: string,
  labels: ChecklistLabels,
  now: Date,
  change: (ctx: { booking: BookingRecord; ops: EventOperationsRecord; tx: BookingTransaction }) => OpsResult | { ok: true; ops: EventOperationsRecord; audit: AuditRecord }
): Promise<OpsResult> {
  return store.runTransaction(async (tx): Promise<OpsResult> => {
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const booking = found.data;
    // Cancelled / rejected / pending bookings are not events; their history stays readable.
    if (!isOperationalBooking(booking)) return { ok: false, code: "not_operational" };
    const existing = await tx.getOperations(bookingId);
    const ops = existing ? existing.data : newOperations(booking, labels, now);
    const result = change({ booking, ops, tx });
    if (!result.ok) return result;
    if ("operations" in result) return result;
    const next = { ...result.ops, updatedAt: now };
    tx.putOperations(next, existing ? existing.version : null);
    tx.createAudit(result.audit);
    return { ok: true, operations: next };
  });
}

// ------------------------------------------------------------ status

export async function setOpsStatus(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  to: unknown,
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  if (!(OPS_STATUSES as readonly unknown[]).includes(to)) return { ok: false, code: "invalid_ops_status" };
  const now = options.now ?? new Date();
  const target = to as OpsStatus;
  return withOperations(store, bookingId, options.labels, now, ({ booking, ops }) => {
    const error = opsTransitionError(ops.status, target, booking.eventDate, businessToday(now));
    if (error) return { ok: false, code: error as OpsFailure };
    let completedSnapshot = ops.completedSnapshot;
    if (target === "completed") {
      const f = financialSummary(booking);
      completedSnapshot = {
        eventDate: booking.eventDate,
        slotLabel: booking.slotLabel,
        hallName: booking.hallName,
        guestCount: booking.guestCount,
        customerName: booking.customer.name,
        total: f.total,
        paid: f.paid,
        remaining: f.remaining,
      };
    }
    return {
      ok: true,
      ops: { ...ops, status: target, completedSnapshot },
      audit: opsAudit("ops_status_changed", actor, bookingId, now, { type: "operations", id: bookingId }, {
        before: { status: ops.status },
        after: { status: target },
      }),
    };
  });
}

// --------------------------------------------------------- checklist

export async function updateChecklistItem(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  itemId: unknown,
  update: { status?: unknown; note?: unknown },
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  if (typeof itemId !== "string" || itemId.length > 200) return { ok: false, code: "item_not_found" };
  if (update.status !== undefined && !(CHECKLIST_STATUSES as readonly unknown[]).includes(update.status)) {
    return { ok: false, code: "invalid_checklist_status" };
  }
  if (update.note !== undefined && (typeof update.note !== "string" || update.note.length > CHECKLIST_NOTE_MAX)) {
    return { ok: false, code: "invalid_note" };
  }
  const now = options.now ?? new Date();
  return withOperations(store, bookingId, options.labels, now, ({ ops }) => {
    const item = ops.checklist.find((i) => i.id === itemId);
    if (!item) return { ok: false, code: "item_not_found" };
    const status = (update.status as ChecklistStatus | undefined) ?? item.status;
    const note = update.note === undefined ? item.note : (update.note as string).trim();
    const completing = status === "completed" && item.status !== "completed";
    const reopening = status !== "completed" && item.status === "completed";
    const next = {
      ...item,
      status,
      note,
      updatedAt: now,
      updatedBy: who(actor),
      completedAt: completing ? now : reopening ? null : item.completedAt,
      completedBy: completing ? who(actor) : reopening ? null : item.completedBy,
    };
    return {
      ok: true,
      ops: { ...ops, checklist: ops.checklist.map((i) => (i.id === item.id ? next : i)) },
      audit: opsAudit("checklist_item_updated", actor, bookingId, now, { type: "operations", id: bookingId }, {
        before: { item: item.label, status: item.status },
        after: { item: item.label, status, noteChanged: note !== item.note },
        reason: completing ? "completed" : reopening ? "reopened" : "",
      }),
    };
  });
}

export async function addChecklistItem(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  label: unknown,
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  const text = typeof label === "string" ? label.trim() : "";
  if (text.length < 2 || text.length > CHECKLIST_LABEL_MAX) return { ok: false, code: "invalid_label" };
  const now = options.now ?? new Date();
  return withOperations(store, bookingId, options.labels, now, ({ ops }) => {
    if (ops.checklist.length >= MAX_CHECKLIST_ITEMS) return { ok: false, code: "too_many_items" };
    const item = {
      id: `custom:${randomUUID().slice(0, 8)}`,
      label: text,
      source: "custom" as const,
      sourceId: null,
      status: "pending" as const,
      note: "",
      removed: false,
      updatedAt: now,
      updatedBy: who(actor),
      completedAt: null,
      completedBy: null,
    };
    return {
      ok: true,
      ops: { ...ops, checklist: [...ops.checklist, item] },
      audit: opsAudit("checklist_item_added", actor, bookingId, now, { type: "operations", id: bookingId }, { after: { item: text } }),
    };
  });
}

/** After an approved booking change: add items for new selections, mark removed ones (never delete). */
export async function syncChecklistWithBooking(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  const now = options.now ?? new Date();
  return withOperations(store, bookingId, options.labels, now, ({ booking, ops }) => {
    const r = syncChecklist(ops.checklist, booking, options.labels);
    if (r.added + r.removed + r.restored === 0) return { ok: false, code: "nothing_to_sync" };
    return {
      ok: true,
      ops: { ...ops, checklist: r.checklist },
      audit: opsAudit("checklist_synced", actor, bookingId, now, { type: "operations", id: bookingId }, {
        after: { added: r.added, markedRemoved: r.removed, restored: r.restored },
      }),
    };
  });
}

// ------------------------------------------------------------- notes

export async function addOpsNote(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  text: unknown,
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value || value.length > OPS_NOTE_MAX) return { ok: false, code: "invalid_note" };
  const now = options.now ?? new Date();
  return withOperations(store, bookingId, options.labels, now, ({ ops }) => {
    if (ops.notes.length >= MAX_NOTES) return { ok: false, code: "too_many_items" };
    const note = { id: `n_${randomUUID().replace(/-/g, "").slice(0, 12)}`, text: value, createdAt: now, createdBy: who(actor), updatedAt: now, updatedBy: who(actor) };
    return {
      ok: true,
      ops: { ...ops, notes: [...ops.notes, note] },
      // The note text itself stays in the operations record; the audit keeps only its size.
      audit: opsAudit("ops_note_added", actor, bookingId, now, { type: "operations", id: bookingId }, { after: { noteId: note.id, length: value.length } }),
    };
  });
}

export async function editOpsNote(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  noteId: unknown,
  text: unknown,
  options: { now?: Date; labels: ChecklistLabels }
): Promise<OpsResult> {
  const value = typeof text === "string" ? text.trim() : "";
  if (!value || value.length > OPS_NOTE_MAX) return { ok: false, code: "invalid_note" };
  const now = options.now ?? new Date();
  return withOperations(store, bookingId, options.labels, now, ({ ops }) => {
    const note = ops.notes.find((n) => n.id === noteId);
    if (!note) return { ok: false, code: "note_not_found" };
    return {
      ok: true,
      ops: { ...ops, notes: ops.notes.map((n) => (n.id === note.id ? { ...n, text: value, updatedAt: now, updatedBy: who(actor) } : n)) },
      audit: opsAudit("ops_note_updated", actor, bookingId, now, { type: "operations", id: bookingId }, {
        before: { noteId: note.id, length: note.text.length },
        after: { noteId: note.id, length: value.length },
      }),
    };
  });
}

// ------------------------------------------------------------ vendors

export interface VendorInput {
  name: string;
  category: VendorCategory;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  notes: string;
}
export type VendorFieldErrors = Partial<Record<keyof VendorInput | "body" | "requestKey", { code: string; message: string }>>;

const PHONE = /^\+?[0-9][0-9 -]{6,19}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const VENDOR_FIELDS = ["name", "category", "phone", "whatsapp", "email", "notes"];

/** Server-side vendor validation. Unknown fields are refused. */
export function validateVendorInput(raw: unknown, extraAllowed: string[] = []): { ok: true; value: VendorInput } | { ok: false; errors: VendorFieldErrors } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: { body: { code: "invalid_body", message: "The request could not be read." } } };
  }
  const body = raw as Record<string, unknown>;
  const errors: VendorFieldErrors = {};
  const extra = Object.keys(body).find((k) => !VENDOR_FIELDS.includes(k) && !extraAllowed.includes(k));
  if (extra) errors.body = { code: "unexpected_field", message: `Unexpected field: ${extra.slice(0, 40)}` };
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : body[k] === undefined || body[k] === null ? "" : null);
  const name = str("name");
  if (name === null || name.length < 2 || name.length > 100) errors.name = { code: "invalid_name", message: "Enter the vendor's name (2–100 characters)." };
  if (!(VENDOR_CATEGORIES as readonly unknown[]).includes(body.category)) errors.category = { code: "invalid_category", message: "Choose a category." };
  const phone = str("phone");
  if (phone === null || !PHONE.test(phone)) errors.phone = { code: "invalid_phone", message: "Enter a phone number (digits, spaces, + or -)." };
  const whatsapp = str("whatsapp");
  if (whatsapp === null || (whatsapp && !PHONE.test(whatsapp))) errors.whatsapp = { code: "invalid_whatsapp", message: "Enter a valid WhatsApp number, or leave it empty." };
  const email = str("email");
  if (email === null || (email && (!EMAIL.test(email) || email.length > 254))) errors.email = { code: "invalid_email", message: "Enter a valid email, or leave it empty." };
  const notes = str("notes");
  if (notes === null || notes.length > 1000) errors.notes = { code: "invalid_notes", message: "Keep notes under 1000 characters." };
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name: name!, category: body.category as VendorCategory, phone: phone!, whatsapp: whatsapp || null, email: email ? email.toLowerCase() : null, notes: notes! },
  };
}

const REQUEST_KEY = /^[A-Za-z0-9_-]{16,80}$/;
export const deriveVendorId = (adminUid: string, requestKey: string) =>
  `vd_${createHash("sha256").update(`vendor\n${adminUid}\n${requestKey}`).digest("hex").slice(0, 20)}`;

export type VendorResult =
  | { ok: true; vendor: VendorRecord; replayed?: boolean }
  | { ok: false; code: "not_found" | "invalid_request_key" | "duplicate_request" | "stale" | "no_change" };

/** Adds a vendor entered by the admin. The same form submitted twice creates one vendor. */
export async function createVendor(
  store: BookingStore,
  actor: Actor,
  input: VendorInput,
  requestKey: unknown,
  options: { now?: Date } = {}
): Promise<VendorResult> {
  if (typeof requestKey !== "string" || !REQUEST_KEY.test(requestKey)) return { ok: false, code: "invalid_request_key" };
  const now = options.now ?? new Date();
  const vendorId = deriveVendorId(actor.uid, requestKey);
  return store.runTransaction(async (tx): Promise<VendorResult> => {
    const existing = await tx.getVendor(vendorId);
    if (existing) {
      return existing.data.name === input.name ? { ok: true, vendor: existing.data, replayed: true } : { ok: false, code: "duplicate_request" };
    }
    const vendor: VendorRecord = {
      schemaVersion: OPERATIONS_SCHEMA_VERSION,
      vendorId,
      ...input,
      active: true,
      createdAt: now,
      createdBy: who(actor),
      updatedAt: now,
      updatedBy: who(actor),
    };
    tx.putVendor(vendor, null);
    tx.createAudit(opsAudit("vendor_created", actor, "", now, { type: "vendor", id: vendorId }, { after: { name: input.name, category: input.category } }));
    return { ok: true, vendor };
  });
}

/** Edits a vendor's details and/or activates/deactivates it. Never deletes. */
export async function updateVendor(
  store: BookingStore,
  actor: Actor,
  vendorId: string,
  change: { details?: VendorInput; active?: boolean; expectedUpdatedAt?: string },
  options: { now?: Date } = {}
): Promise<VendorResult> {
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<VendorResult> => {
    const found = await tx.getVendor(vendorId);
    if (!found) return { ok: false, code: "not_found" };
    const v = found.data;
    if (change.expectedUpdatedAt && new Date(v.updatedAt).toISOString() !== change.expectedUpdatedAt) return { ok: false, code: "stale" };
    const next: VendorRecord = { ...v, ...(change.details ?? {}), active: change.active ?? v.active, updatedAt: now, updatedBy: who(actor) };
    const changed = (Object.keys(change.details ?? {}) as (keyof VendorInput)[]).filter((k) => next[k] !== v[k]);
    const activeChanged = next.active !== v.active;
    if (!changed.length && !activeChanged) return { ok: false, code: "no_change" };
    tx.putVendor(next, found.version);
    const action = activeChanged ? (next.active ? "vendor_activated" : "vendor_deactivated") : "vendor_updated";
    tx.createAudit(
      opsAudit(action, actor, "", now, { type: "vendor", id: vendorId }, {
        before: { fields: changed, active: v.active },
        after: { fields: changed, active: next.active },
      })
    );
    return { ok: true, vendor: next };
  });
}

// --------------------------------------------------------- assignments

export interface VendorConflict {
  bookingId: string;
  reference: string;
  eventDate: string;
  slotLabel: string;
}

/** Active assignments of the vendor whose event is on the same date and slot as `b`. */
async function conflictsFor(
  readBooking: (id: string) => Promise<BookingRecord | null>,
  assignments: VendorAssignmentRecord[],
  b: Pick<BookingRecord, "bookingId" | "eventDate" | "slotId">
): Promise<VendorConflict[]> {
  const out: VendorConflict[] = [];
  for (const a of assignments) {
    if (!isActiveAssignment(a) || a.bookingId === b.bookingId) continue;
    const other = await readBooking(a.bookingId);
    // Only events that still happen count (a cancelled booking frees the vendor).
    if (other && isOperationalBooking(other) && other.eventDate === b.eventDate && other.slotId === b.slotId) {
      out.push({ bookingId: other.bookingId, reference: bookingReference(other.bookingId), eventDate: other.eventDate, slotLabel: other.slotLabel });
    }
  }
  return out;
}

/** For the event sheet: conflicts of this booking's active assignments, from current booking data. */
export async function assignmentConflicts(store: BookingStore, b: BookingRecord, assignments: VendorAssignmentRecord[]) {
  const result: Record<string, VendorConflict[]> = {};
  for (const a of assignments.filter(isActiveAssignment)) {
    const others = await store.listAssignmentsOfVendor(a.vendorId, 200);
    const c = await conflictsFor((id) => store.getBooking(id), others, b);
    if (c.length) result[a.assignmentId] = c;
  }
  return result;
}

export type AssignResult =
  | { ok: true; assignment: VendorAssignmentRecord }
  | { ok: false; code: "not_found" | "not_operational" | "vendor_not_found" | "vendor_inactive" | "invalid_category" | "invalid_notes" | "already_assigned" | "event_over" }
  | { ok: false; code: "vendor_conflict"; conflicts: VendorConflict[] };

/**
 * Assigns an existing vendor to an event. Refused when the vendor is already
 * assigned to another (still active) event on the same date and slot. The
 * vendor's assignments are read inside the transaction, so two admins
 * assigning the same vendor to clashing events at once cannot both succeed.
 */
export async function assignVendor(
  store: BookingStore,
  actor: Actor,
  bookingId: string,
  input: { vendorId: unknown; category: unknown; notes?: unknown },
  options: { now?: Date } = {}
): Promise<AssignResult> {
  if (!(VENDOR_CATEGORIES as readonly unknown[]).includes(input.category)) return { ok: false, code: "invalid_category" };
  const notes = input.notes === undefined ? "" : typeof input.notes === "string" && input.notes.length <= 500 ? input.notes.trim() : null;
  if (notes === null) return { ok: false, code: "invalid_notes" };
  if (typeof input.vendorId !== "string" || !/^vd_[0-9a-f]{20}$/.test(input.vendorId)) return { ok: false, code: "vendor_not_found" };
  const vendorId = input.vendorId;
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<AssignResult> => {
    const found = await tx.getBooking(bookingId);
    if (!found) return { ok: false, code: "not_found" };
    const b = found.data;
    if (b.status !== "confirmed") return { ok: false, code: b.status === "completed" ? "event_over" : "not_operational" };
    const vendor = await tx.getVendor(vendorId);
    if (!vendor) return { ok: false, code: "vendor_not_found" };
    if (!vendor.data.active) return { ok: false, code: "vendor_inactive" };
    const ofVendor = await tx.listAssignmentsForVendor(vendorId);
    if (ofVendor.some((a) => isActiveAssignment(a) && a.bookingId === bookingId && a.category === input.category)) {
      return { ok: false, code: "already_assigned" };
    }
    const cache = new Map<string, BookingRecord | null>();
    const conflicts = await conflictsFor(
      async (id) => {
        if (!cache.has(id)) cache.set(id, (await tx.getBooking(id))?.data ?? null);
        return cache.get(id)!;
      },
      ofVendor,
      b
    );
    if (conflicts.length) return { ok: false, code: "vendor_conflict", conflicts };
    const assignment: VendorAssignmentRecord = {
      schemaVersion: OPERATIONS_SCHEMA_VERSION,
      assignmentId: `va_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
      bookingId,
      vendorId,
      vendorName: vendor.data.name,
      category: input.category as VendorCategory,
      status: "assigned",
      notes,
      assignedBy: who(actor),
      assignedAt: now,
      updatedAt: now,
      updatedBy: who(actor),
    };
    tx.createAssignment(assignment);
    tx.createAudit(
      opsAudit("vendor_assigned", actor, bookingId, now, { type: "operations", id: bookingId }, {
        after: { assignmentId: assignment.assignmentId, vendorId, vendor: vendor.data.name, category: assignment.category },
      })
    );
    return { ok: true, assignment };
  });
}

export type AssignmentStatusResult =
  | { ok: true; assignment: VendorAssignmentRecord }
  | { ok: false; code: "not_found" | "invalid_assignment_status" | "invalid_transition" | "not_operational" };

/** assigned -> confirmed (vendor confirmed); assigned/confirmed -> cancelled (unassigned; kept for history). */
export async function setAssignmentStatus(
  store: BookingStore,
  actor: Actor,
  assignmentId: string,
  to: unknown,
  options: { now?: Date } = {}
): Promise<AssignmentStatusResult> {
  if (to !== "confirmed" && to !== "cancelled") return { ok: false, code: "invalid_assignment_status" };
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<AssignmentStatusResult> => {
    const found: Versioned<VendorAssignmentRecord> | null = await tx.getAssignment(assignmentId);
    if (!found) return { ok: false, code: "not_found" };
    const a = found.data;
    if (a.status === "cancelled" || (to === "confirmed" && a.status !== "assigned")) return { ok: false, code: "invalid_transition" };
    if (to === "confirmed") {
      const b = await tx.getBooking(a.bookingId);
      if (!b || b.data.status !== "confirmed") return { ok: false, code: "not_operational" };
    }
    const patch = { status: to, updatedAt: now, updatedBy: who(actor) } as const;
    tx.updateAssignment(assignmentId, patch, found.version);
    tx.createAudit(
      opsAudit(to === "confirmed" ? "vendor_assignment_confirmed" : "vendor_unassigned", actor, a.bookingId, now, { type: "operations", id: a.bookingId }, {
        before: { assignmentId, status: a.status },
        after: { assignmentId, status: to, vendor: a.vendorName, category: a.category },
      })
    );
    return { ok: true, assignment: { ...a, ...patch } };
  });
}
