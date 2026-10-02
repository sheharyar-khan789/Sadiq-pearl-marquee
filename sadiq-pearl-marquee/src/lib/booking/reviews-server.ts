// Guest reviews — SERVER ONLY loaders (Phase 10).
import "server-only";
import { run } from "./admin-server";
import { reviewAggregate, reviewIdFor, toPublicReview, type PublicReview, type ReviewRecord, type ReviewStatus } from "./reviews";
import { bookingStore, logBookingError, withTimeout } from "./server";

const PUBLIC_LIMIT = 200;

export type PublicReviewsResult =
  | { ok: true; reviews: PublicReview[]; aggregate: ReturnType<typeof reviewAggregate> }
  | { ok: false };

/** Approved reviews only (public). Never throws: an outage shows an honest message, not an empty "no reviews". */
export async function loadPublicReviews(): Promise<PublicReviewsResult> {
  const store = bookingStore();
  if (!store) return { ok: false };
  try {
    const approved = (await withTimeout(store.listReviewsByStatus("approved", PUBLIC_LIMIT), 8_000)).filter((r) => r.status === "approved");
    return {
      ok: true,
      reviews: approved.sort((a, b) => +new Date(b.publishedAt ?? b.updatedAt) - +new Date(a.publishedAt ?? a.updatedAt)).map(toPublicReview),
      aggregate: reviewAggregate(approved),
    };
  } catch (error) {
    logBookingError("public reviews", error);
    return { ok: false };
  }
}

/** The signed-in customer's review of one of their bookings (ownership re-checked). */
export async function loadCustomerReview(uid: string, bookingId: string): Promise<ReviewRecord | null | "error"> {
  const store = bookingStore();
  if (!store) return "error";
  try {
    const r = await withTimeout(store.getReview(reviewIdFor(bookingId)), 8_000);
    return r && r.customerId === uid ? r : null;
  } catch (error) {
    logBookingError("customer review", error);
    return "error";
  }
}

/** Super Admin moderation list (verified inside run()). */
export function loadAdminReviews(status: ReviewStatus) {
  return run("reviews", async (store) => {
    const [list, pending] = await Promise.all([store.listReviewsByStatus(status, 300), status === "pending" ? null : store.listReviewsByStatus("pending", 300)]);
    return { list, pendingCount: (pending ?? list).length };
  });
}
