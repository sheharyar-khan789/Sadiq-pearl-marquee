// Shared helpers for Phase 8 admin API routes — SERVER ONLY.
import "server-only";
import { loadConfigFresh } from "../config/config-server";
import { labelsFor } from "./admin-server";
import type { ChecklistLabels } from "./operations-model";

/** Labels for generating checklist items from the booking's selections (current configuration). */
export async function checklistLabels(): Promise<ChecklistLabels | null> {
  const cfg = await loadConfigFresh();
  return cfg.ok ? { service: labelsFor(cfg.config).service } : null;
}

export const BOOKING_ID = /^bk_[0-9a-f]{24}$/;
/** 404 missing, 400 malformed input, 409 a state conflict (e.g. a transition not allowed now). */
const BAD_INPUT = new Set([
  "invalid_ops_status",
  "invalid_checklist_status",
  "invalid_note",
  "invalid_label",
  "invalid_category",
  "invalid_notes",
  "invalid_assignment_status",
  "invalid_action",
]);
export const statusFor = (code: string) =>
  code === "not_found" || code === "vendor_not_found" || code === "item_not_found" || code === "note_not_found" ? 404 : BAD_INPUT.has(code) ? 400 : 409;
