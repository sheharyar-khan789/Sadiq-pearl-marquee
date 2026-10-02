// POST /api/admin/reviews/{reviewId}  { decision: "approve" | "reject", note?, expectedUpdatedAt? }
// Super Admin only. Moderates a guest review (audited). Approving makes it
// public; the public reviews page is refreshed immediately.
import { revalidatePath } from "next/cache";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { moderateReview } from "@/lib/booking/reviews";

const MESSAGES: Record<string, string> = {
  stale: "The guest edited this review since you opened it. Reload and review it again.",
  already_decided: "This review already has that status.",
  invalid_decision: "Unknown decision.",
};

export async function POST(request: Request, { params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    const r = await moderateReview(store, admin, reviewId, body.decision, {
      note: body.note,
      expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
    });
    if (!r.ok) {
      if (r.code === "not_found") return failure("not_found", 404);
      return json({ error: r.code, message: MESSAGES[r.code] }, r.code === "invalid_decision" ? 400 : 409);
    }
    revalidatePath("/reviews");
    return json({ ok: true, status: r.review.status });
  });
}
