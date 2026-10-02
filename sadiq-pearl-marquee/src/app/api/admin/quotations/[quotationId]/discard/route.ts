// POST /api/admin/quotations/{id}/discard
// Super Admin only. Discards an unissued draft (issued quotations are permanent).
import { discardQuotation } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  return adminMutation(request, async ({ admin, store }) => {
    if (!/^qt_[0-9a-f]{32}$/.test(quotationId)) return failure("not_found", 404);
    const result = await discardQuotation(store, admin, quotationId);
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : 409);
    return json({ ok: true });
  });
}
