// Shared helpers for admin API routes — SERVER ONLY.
import "server-only";
import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/server";
import type { AdminActor } from "./audit-model";
import { bookingStore, logBookingError, TimeoutError, withTimeout } from "./server";
import type { BookingStore } from "./store";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Human-readable messages for admin error codes (shown in the panel). */
export const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  slot_unavailable: "That slot is already taken by another booking. Nothing was changed.",
  invalid_transition: "This status change isn't allowed from the booking's current status.",
  invalid_action: "Unknown action.",
  event_not_over: "An event can only be marked completed on or after its date.",
  stale: "This booking changed since you opened it. Reload the page and review it again.",
  not_found: "Booking or request not found.",
  not_open: "This request has already been decided.",
  not_allowed: "The booking is no longer active, so this request can't be approved.",
  invalid_change: "The requested change is no longer valid (date passed, capacity or menu). Reject it or ask the customer.",
  invalid_decision: "Unknown decision.",
  invalid_notes: "Notes are too long.",
  customer_not_found: "That customer account was not found.",
  // Phase 7 — payments / quotations
  total_below_paid:
    "Refund / financial adjustment required: after this change the price would be lower than the amount already paid. Nothing was changed. Settle the difference with the customer first (refunds are not recorded in the system yet).",
  already_priced: "This booking already has a price. Existing prices are never recalculated.",
  pricing_incomplete: "Some prices this booking needs are not configured yet (see Settings → Pricing).",
  pricing_pending: "This booking has no price yet. Calculate its price first.",
  booking_inactive: "Payments can't be recorded on a cancelled, rejected or expired booking.",
  already_paid: "This booking is already fully paid.",
  overpayment: "The amount is more than the remaining balance. Nothing was recorded.",
  duplicate_request: "This form was already used for a different payment. Reload the page and try again.",
  invalid_payment: "Please correct the payment details.",
  already_voided: "This payment has already been voided.",
  invalid_reason: "Please give a short reason (3–500 characters).",
  not_draft: "Only a draft quotation can be issued or discarded.",
  outdated: "The booking's price changed after this draft was made. Generate a new draft.",
  // Phase 8 — event operations / vendors
  not_operational: "Only confirmed (or completed) events have operations. Nothing was changed.",
  invalid_ops_status: "Unknown operational status.",
  invalid_ops_transition: "Operational status moves one step at a time (forward or back).",
  event_not_started: "“In progress” and “Completed” are only possible from the event date.",
  item_not_found: "That checklist item no longer exists. Reload the page.",
  note_not_found: "That note no longer exists. Reload the page.",
  invalid_checklist_status: "Unknown checklist status.",
  invalid_note: "Enter a note (up to the allowed length).",
  invalid_label: "Enter a checklist item (2–120 characters).",
  too_many_items: "This event already has the maximum number of items.",
  nothing_to_sync: "The checklist already matches the booking.",
  vendor_not_found: "That vendor was not found.",
  vendor_inactive: "That vendor is inactive. Reactivate it first.",
  invalid_category: "Choose a category.",
  already_assigned: "This vendor is already assigned to this event for that category.",
  event_over: "This event is completed; vendors can no longer be assigned.",
  vendor_conflict: "This vendor is already assigned to another event in the same slot. Nothing was changed.",
  invalid_assignment_status: "Unknown assignment status.",
  invalid_vendor: "Please correct the vendor details.",
  no_change: "Nothing was changed.",
};

/**
 * Runs an admin mutation: Super Admin check (server-side), JSON body parse,
 * then the work with a timeout. Database errors are logged (code only) and
 * reported, never swallowed or turned into a success.
 */
export async function adminMutation(
  request: Request,
  work: (ctx: { admin: AdminActor; store: BookingStore; body: Record<string, unknown> }) => Promise<Response>
): Promise<Response> {
  const auth = await requireSuperAdminApi(request);
  if (!auth.ok) return json({ error: auth.error }, auth.status);
  const store = bookingStore();
  if (!store) return json({ error: "booking_unavailable" }, 503);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 32 * 1024) return json({ error: "invalid_request" }, 413);
    const parsed = JSON.parse(text || "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    body = parsed;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    return await withTimeout(work({ admin: auth.admin, store, body }), 15_000);
  } catch (error) {
    logBookingError("admin action", error);
    return json(
      { error: error instanceof TimeoutError ? "timeout" : "database_error", message: "The database didn't respond. Nothing is shown as saved; reload to check." },
      503
    );
  }
}

export function failure(code: string, status = 409) {
  return json({ error: code, message: ADMIN_ERROR_MESSAGES[code] ?? "The action could not be completed." }, status);
}

export const optionalString = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
