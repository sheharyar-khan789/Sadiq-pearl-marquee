// Guest reviews (Phase 10) — model and server logic.
//
//   reviews/{rv_<hash(bookingId)>}   at most ONE review per booking
//
// Eligibility (the safest minimal rule; no other business rule exists):
// a signed-in customer may review a booking only if it is THEIR booking
// (booking.customerId === session uid) and the booking status is "completed"
// (the event took place). Identity and booking ownership always come from the
// verified session and the stored booking — never from the request body.
//
// Moderation: new and edited reviews are "pending" and never public. Only the
// Super Admin approves or rejects (audited). Public pages show "approved" only.
// Aggregates (count, average, distribution) are computed from approved reviews.
import { createHash } from "node:crypto";
import { auditRecord } from "./engine.ts";
import type { AdminActor } from "./audit-model.ts";
import type { BookingRecord } from "./model.ts";
import type { BookingStore } from "./store.ts";

export const REVIEWS_COLLECTION = "reviews";
export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
  pending: "Waiting for approval",
  approved: "Published",
  rejected: "Not published",
};
export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 1000;
export const REVIEW_NAME_MAX = 60;

export interface ReviewRecord {
  schemaVersion: number;
  reviewId: string;
  bookingId: string;
  customerId: string;
  /** Name the customer chose to show publicly. */
  displayName: string;
  rating: number;
  text: string;
  /** Snapshot of the event type for context ("Walima"), taken from the booking. */
  eventTypeLabel: string;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Last moderation decision (internal note never shown publicly). */
  moderation: { by: string; at: Date; note: string } | null;
  /** When it was last approved (public date). */
  publishedAt: Date | null;
  /** Number of customer edits after the first submission. */
  revision: number;
}

export const reviewIdFor = (bookingId: string) => `rv_${createHash("sha256").update(`review\n${bookingId}`).digest("hex").slice(0, 24)}`;

export interface ReviewInput {
  rating: number;
  text: string;
  displayName: string;
}

export function validateReviewInput(raw: unknown): { ok: true; value: ReviewInput } | { ok: false; errors: Record<string, { code: string; message: string }> } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: { body: { code: "invalid_body", message: "The review could not be read." } } };
  const b = raw as Record<string, unknown>;
  const errors: Record<string, { code: string; message: string }> = {};
  const extra = Object.keys(b).find((k) => !["rating", "text", "displayName"].includes(k));
  if (extra) errors.body = { code: "unexpected_field", message: `Unexpected field: ${extra.slice(0, 40)}` };
  if (typeof b.rating !== "number" || !Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5) errors.rating = { code: "invalid_rating", message: "Choose a rating from 1 to 5 stars." };
  const text = typeof b.text === "string" ? b.text.trim().replace(/\s+\n/g, "\n") : "";
  if (text.length < REVIEW_TEXT_MIN || text.length > REVIEW_TEXT_MAX) errors.text = { code: "invalid_text", message: `Write ${REVIEW_TEXT_MIN}–${REVIEW_TEXT_MAX} characters.` };
  const displayName = typeof b.displayName === "string" ? b.displayName.trim().replace(/\s+/g, " ") : "";
  if (displayName.length < 2 || displayName.length > REVIEW_NAME_MAX) errors.displayName = { code: "invalid_name", message: `Enter the name to show (2–${REVIEW_NAME_MAX} characters).` };
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { rating: b.rating as number, text, displayName } };
}

/** Whether this customer may review this booking. */
export function reviewEligibility(b: Pick<BookingRecord, "customerId" | "status"> | null, uid: string): "ok" | "not_found" | "not_completed" {
  if (!b || !uid || b.customerId !== uid) return "not_found";
  if (b.status !== "completed") return "not_completed";
  return "ok";
}

export type SubmitReviewResult = { ok: true; review: ReviewRecord; created: boolean } | { ok: false; code: "not_found" | "not_completed" | "no_change" };

/** Create or edit the customer's review of their completed booking. Every submission goes (back) to moderation. */
export async function submitReview(store: BookingStore, uid: string, bookingId: string, input: ReviewInput, options: { now?: Date } = {}): Promise<SubmitReviewResult> {
  if (!/^bk_[0-9a-f]{24}$/.test(bookingId)) return { ok: false, code: "not_found" };
  const now = options.now ?? new Date();
  const id = reviewIdFor(bookingId);
  return store.runTransaction(async (tx): Promise<SubmitReviewResult> => {
    const booking = await tx.getBooking(bookingId);
    const eligible = reviewEligibility(booking?.data ?? null, uid);
    if (eligible !== "ok") return { ok: false, code: eligible };
    const existing = await tx.getReview(id);
    if (existing && existing.data.customerId !== uid) return { ok: false, code: "not_found" };
    if (existing) {
      const e = existing.data;
      if (e.rating === input.rating && e.text === input.text && e.displayName === input.displayName) return { ok: false, code: "no_change" };
      const next: ReviewRecord = { ...e, ...input, status: "pending", updatedAt: now, revision: e.revision + 1 };
      tx.putReview(next, existing.version);
      return { ok: true, review: next, created: false };
    }
    const review: ReviewRecord = {
      schemaVersion: 1,
      reviewId: id,
      bookingId,
      customerId: uid,
      ...input,
      eventTypeLabel: booking!.data.eventTypeLabel,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      moderation: null,
      publishedAt: null,
      revision: 0,
    };
    tx.putReview(review, null);
    return { ok: true, review, created: true };
  });
}

export type ModerateResult = { ok: true; review: ReviewRecord } | { ok: false; code: "not_found" | "invalid_decision" | "stale" | "already_decided" };

/** Super Admin approves or rejects a review (audited; the note stays internal). */
export async function moderateReview(
  store: BookingStore,
  actor: AdminActor,
  reviewId: string,
  decision: unknown,
  options: { note?: unknown; expectedUpdatedAt?: string; now?: Date } = {}
): Promise<ModerateResult> {
  if (decision !== "approve" && decision !== "reject") return { ok: false, code: "invalid_decision" };
  if (!/^rv_[0-9a-f]{24}$/.test(reviewId)) return { ok: false, code: "not_found" };
  const note = typeof options.note === "string" ? options.note.trim().slice(0, 500) : "";
  const now = options.now ?? new Date();
  return store.runTransaction(async (tx): Promise<ModerateResult> => {
    const found = await tx.getReview(reviewId);
    if (!found) return { ok: false, code: "not_found" };
    const r = found.data;
    // The admin decided on what they saw: a customer edit in between makes the page stale.
    if (options.expectedUpdatedAt && new Date(r.updatedAt).toISOString() !== options.expectedUpdatedAt) return { ok: false, code: "stale" };
    const to: ReviewStatus = decision === "approve" ? "approved" : "rejected";
    if (r.status === to) return { ok: false, code: "already_decided" };
    const next: ReviewRecord = {
      ...r,
      status: to,
      moderation: { by: actor.email ?? actor.uid, at: now, note },
      publishedAt: to === "approved" ? now : r.publishedAt,
    };
    tx.putReview(next, found.version);
    tx.createAudit({
      ...auditRecord(to === "approved" ? "review_approved" : "review_rejected", actor, r.bookingId, now, {
        before: { status: r.status },
        after: { status: to, rating: r.rating, revision: r.revision },
        // The review text is not copied into the audit trail.
      }),
      entityType: "review",
      entityId: reviewId,
    });
    return { ok: true, review: next };
  });
}

/** Public, serialisable view: only what is meant to be shown. */
export interface PublicReview {
  reviewId: string;
  displayName: string;
  rating: number;
  text: string;
  eventTypeLabel: string;
  publishedAt: string;
}
export const toPublicReview = (r: ReviewRecord): PublicReview => ({
  reviewId: r.reviewId,
  displayName: r.displayName,
  rating: r.rating,
  text: r.text,
  eventTypeLabel: r.eventTypeLabel,
  publishedAt: new Date(r.publishedAt ?? r.updatedAt).toISOString(),
});

/** Count, average (1 decimal) and 1–5 distribution of APPROVED reviews only. */
export function reviewAggregate(list: Pick<ReviewRecord, "status" | "rating">[]) {
  const approved = list.filter((r) => r.status === "approved");
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: approved.filter((r) => r.rating === stars).length }));
  const count = approved.length;
  const average = count ? Math.round((approved.reduce((t, r) => t + r.rating, 0) / count) * 10) / 10 : null;
  return { count, average, distribution };
}
