// Event operations (Phase 8) — data model.
//
//   eventOperations/{bookingId}      one operational record per booking (same ID:
//                                    it can never duplicate or drift from its booking)
//   vendors/{vendorId}               vendors entered by the Super Admin (none are pre-filled)
//   vendorAssignments/{assignmentId} a vendor assigned to one booking's event
//
// The BOOKING stays the source of truth for date, hall, slot, customer, guests
// and booking status (always read live); Phase 7 stays the source of truth for
// prices and payments. Phase 8 owns only: operational status, checklist,
// vendor records/assignments and internal operational notes.
// All three collections are server-only (Admin SDK); browsers have no access.
import type { BookingRecord } from "./model.ts";

export const OPERATIONS_COLLECTION = "eventOperations";
export const VENDORS_COLLECTION = "vendors";
export const ASSIGNMENTS_COLLECTION = "vendorAssignments";
export const OPERATIONS_SCHEMA_VERSION = 1;

// ------------------------------------------------------------ status

/** Operational lifecycle — separate from the booking status (which the booking engine controls). */
export const OPS_STATUSES = ["not_started", "preparing", "ready", "in_progress", "completed"] as const;
export type OpsStatus = (typeof OPS_STATUSES)[number];
export const OPS_STATUS_LABELS: Readonly<Record<OpsStatus, string>> = {
  not_started: "Not started",
  preparing: "Preparing",
  ready: "Ready",
  in_progress: "In progress",
  completed: "Completed",
};

/** One step forward or back. "In progress" and "Completed" only from the event date on. */
export function opsTransitionError(from: OpsStatus, to: OpsStatus, eventDate: string, today: string): string | null {
  const a = OPS_STATUSES.indexOf(from);
  const b = OPS_STATUSES.indexOf(to);
  if (b < 0) return "invalid_ops_status";
  if (Math.abs(a - b) !== 1) return "invalid_ops_transition";
  if ((to === "in_progress" || to === "completed") && eventDate > today) return "event_not_started";
  return null;
}

/** Booking statuses whose events have operations (pending / review requests are not events yet). */
export const OPERATIONAL_BOOKING_STATUSES = ["confirmed", "completed"] as const;
export const isOperationalBooking = (b: Pick<BookingRecord, "status">) =>
  (OPERATIONAL_BOOKING_STATUSES as readonly string[]).includes(b.status);

// --------------------------------------------------------- checklist

export const CHECKLIST_STATUSES = ["pending", "in_progress", "completed"] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];
export const CHECKLIST_STATUS_LABELS: Readonly<Record<ChecklistStatus, string>> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Done",
};

export interface ChecklistItem {
  id: string;
  label: string;
  /** Where the item came from: generic venue tasks, the booking's selections, or added by staff. */
  source: "venue" | "service" | "menu" | "package" | "custom";
  /** The service / menu / package ID it was generated from (null for venue / custom items). */
  sourceId: string | null;
  status: ChecklistStatus;
  note: string;
  /** True once the booking no longer includes the selection it came from (kept for history). */
  removed: boolean;
  updatedAt: Date | null;
  updatedBy: string | null;
  completedAt: Date | null;
  completedBy: string | null;
}

export interface OpsNote {
  id: string;
  text: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface EventOperationsRecord {
  schemaVersion: number;
  bookingId: string;
  status: OpsStatus;
  checklist: ChecklistItem[];
  notes: OpsNote[];
  /** Set when operations are marked completed: what the event was, for history. */
  completedSnapshot: {
    eventDate: string;
    slotLabel: string;
    hallName: string;
    guestCount: number;
    customerName: string;
    total: number | null;
    paid: number;
    remaining: number | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Labels for the booking's selections (from the configuration; falls back to the stored snapshot). */
export interface ChecklistLabels {
  service: (id: string) => string;
}

const item = (id: string, label: string, source: ChecklistItem["source"], sourceId: string | null): ChecklistItem => ({
  id,
  label,
  source,
  sourceId,
  status: "pending",
  note: "",
  removed: false,
  updatedAt: null,
  updatedBy: null,
  completedAt: null,
  completedBy: null,
});

/**
 * Items the booking actually needs: generic venue preparation, plus one item per
 * selection on the booking (services, menu, package and its included services).
 * Nothing is added for services that were not selected.
 */
export function bookingChecklist(b: BookingRecord, labels: ChecklistLabels): ChecklistItem[] {
  const out: ChecklistItem[] = [
    item("venue:hall", `Hall preparation — ${b.hallName}`, "venue", null),
    item("venue:seating", `Seating for ${b.guestCount.toLocaleString("en-US")} guests`, "venue", null),
  ];
  for (const s of b.services) out.push(item(`service:${s.id}`, `${s.label} — ready`, "service", s.id));
  if (b.package) {
    out.push(item(`package:${b.package.id}`, `Package: ${b.package.name} — ready`, "package", b.package.id));
    for (const id of b.package.serviceIds) {
      if (!b.services.some((s) => s.id === id)) out.push(item(`service:${id}`, `${labels.service(id)} (package) — ready`, "service", id));
    }
  }
  if (b.menuPreference) out.push(item(`menu:${b.menuPreference.id}`, `Menu / catering — ${b.menuPreference.title}`, "menu", b.menuPreference.id));
  return out;
}

/**
 * Brings an existing checklist in line with the booking's CURRENT selections
 * (after an approved change): missing items are added; items whose selection
 * was removed are marked `removed` (never deleted — their history stays).
 */
export function syncChecklist(current: ChecklistItem[], b: BookingRecord, labels: ChecklistLabels): { checklist: ChecklistItem[]; added: number; removed: number; restored: number } {
  const wanted = bookingChecklist(b, labels);
  const wantedIds = new Set(wanted.map((w) => w.id));
  let added = 0;
  let removed = 0;
  let restored = 0;
  const next = current.map((c) => {
    if (c.source === "custom" || c.source === "venue") return c;
    const keep = wantedIds.has(c.id);
    if (!keep && !c.removed) {
      removed++;
      return { ...c, removed: true };
    }
    if (keep && c.removed) {
      restored++;
      return { ...c, removed: false };
    }
    return c;
  });
  for (const w of wanted) {
    if (!next.some((c) => c.id === w.id)) {
      next.push(w);
      added++;
    }
  }
  // Venue seating label follows the current guest count.
  return {
    checklist: next.map((c) => (c.id === "venue:seating" ? { ...c, label: wanted.find((w) => w.id === c.id)!.label } : c)),
    added,
    removed,
    restored,
  };
}

/** Whether the checklist differs from the booking's current selections. */
export function checklistDrift(current: ChecklistItem[], b: BookingRecord, labels: ChecklistLabels) {
  const r = syncChecklist(current, b, labels);
  return r.added + r.removed + r.restored > 0;
}

// ------------------------------------------------------------ vendors

export const VENDOR_CATEGORIES = [
  "decorator",
  "photographer",
  "dj_sound",
  "lighting",
  "florist",
  "furniture",
  "catering",
  "generator",
  "ac",
  "other",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];
export const VENDOR_CATEGORY_LABELS: Readonly<Record<VendorCategory, string>> = {
  decorator: "Decorator",
  photographer: "Photographer",
  dj_sound: "DJ / sound",
  lighting: "Lighting",
  florist: "Florist",
  furniture: "Furniture",
  catering: "Catering",
  generator: "Generator",
  ac: "AC",
  other: "Other",
};

export interface VendorRecord {
  schemaVersion: number;
  vendorId: string;
  name: string;
  category: VendorCategory;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  notes: string;
  active: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export const ASSIGNMENT_STATUSES = ["assigned", "confirmed", "cancelled"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export const ASSIGNMENT_STATUS_LABELS: Readonly<Record<AssignmentStatus, string>> = {
  assigned: "Assigned",
  confirmed: "Confirmed by vendor",
  cancelled: "Unassigned",
};

export interface VendorAssignmentRecord {
  schemaVersion: number;
  assignmentId: string;
  bookingId: string;
  vendorId: string;
  /** Vendor name at assignment time (history stays readable if the vendor is renamed). */
  vendorName: string;
  category: VendorCategory;
  status: AssignmentStatus;
  notes: string;
  assignedBy: string;
  assignedAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export const isActiveAssignment = (a: Pick<VendorAssignmentRecord, "status">) => a.status !== "cancelled";
