// Admin audit trail (Phase 5): adminAudit/{auditId}.
// One record per important admin action, written in the SAME transaction as
// the change it describes (so a change can never happen without its record).
// Server-only collection; never readable by customers. No credentials, tokens
// or passwords are ever stored here.

export const ADMIN_AUDIT_COLLECTION = "adminAudit";

export const AUDIT_ACTIONS = [
  "booking_created_manual",
  "booking_under_review",
  "booking_confirmed",
  "booking_rejected",
  "booking_cancelled",
  "booking_completed",
  "admin_notes_updated",
  "modification_approved",
  "modification_rejected",
  "cancellation_approved",
  "cancellation_rejected",
  "config_created",
  "config_updated",
  "config_deactivated",
  "config_activated",
  "booking_priced",
  "payment_recorded",
  "payment_voided",
  "quotation_generated",
  "quotation_issued",
  "quotation_discarded",
  "vendor_created",
  "vendor_updated",
  "vendor_deactivated",
  "vendor_activated",
  "vendor_assigned",
  "vendor_assignment_confirmed",
  "vendor_unassigned",
  "ops_status_changed",
  "checklist_item_updated",
  "checklist_item_added",
  "checklist_synced",
  "ops_note_added",
  "ops_note_updated",
  "whatsapp_initiated",
  "review_approved",
  "review_rejected",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LABELS: Readonly<Record<AuditAction, string>> = {
  booking_created_manual: "Booking entered by staff",
  booking_under_review: "Marked under review",
  booking_confirmed: "Booking confirmed",
  booking_rejected: "Request rejected",
  booking_cancelled: "Booking cancelled",
  booking_completed: "Event marked completed",
  admin_notes_updated: "Admin notes updated",
  modification_approved: "Change request approved",
  modification_rejected: "Change request rejected",
  cancellation_approved: "Cancellation approved",
  cancellation_rejected: "Cancellation request rejected",
  config_created: "Configuration item added",
  config_updated: "Configuration updated",
  config_deactivated: "Configuration item deactivated",
  config_activated: "Configuration item activated",
  booking_priced: "Price calculated",
  payment_recorded: "Payment recorded",
  payment_voided: "Payment voided",
  quotation_generated: "Quotation drafted",
  quotation_issued: "Quotation issued",
  quotation_discarded: "Quotation draft discarded",
  vendor_created: "Vendor added",
  vendor_updated: "Vendor updated",
  vendor_deactivated: "Vendor deactivated",
  vendor_activated: "Vendor reactivated",
  vendor_assigned: "Vendor assigned",
  vendor_assignment_confirmed: "Vendor assignment confirmed",
  vendor_unassigned: "Vendor unassigned",
  ops_status_changed: "Operational status changed",
  checklist_item_updated: "Checklist item updated",
  checklist_item_added: "Checklist item added",
  checklist_synced: "Checklist synced with booking",
  ops_note_added: "Operational note added",
  ops_note_updated: "Operational note edited",
  whatsapp_initiated: "WhatsApp message opened (manual)",
  review_approved: "Review approved",
  review_rejected: "Review rejected",
};

/** The admin who acted, from the verified session (never from the browser). */
export interface AdminActor {
  uid: string;
  email: string | null;
}

export interface AuditRecord {
  auditId: string;
  action: AuditAction;
  actor: AdminActor;
  /** Empty for configuration changes. */
  bookingId: string;
  requestId: string | null;
  /** Phase 6: "config" for business-configuration changes (absent for booking actions).
   *  Phase 7: "payment" / "quotation" for financial actions (bookingId is also set). */
  entityType?: "config" | "payment" | "quotation" | "operations" | "vendor" | "communication" | "review";
  /** Phase 6: e.g. "services/decoration-1", "pricing", "rules". Phase 7: the payment / quotation ID. */
  entityId?: string;
  /** Small before/after summaries of the fields that changed (no secrets). */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string;
  at: Date;
}
