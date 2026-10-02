// POST /api/admin/quotations/{id}/issue
// Super Admin only. Gives a draft its permanent number and shows it to the
// customer; the previously issued quotation becomes "superseded".
import { issueQuotation } from "@/lib/booking/finance";
import { adminMutation, failure, json } from "@/lib/booking/admin-api";

export async function POST(request: Request, { params }: { params: Promise<{ quotationId: string }> }) {
  const { quotationId } = await params;
  return adminMutation(request, async ({ admin, store }) => {
    if (!/^qt_[0-9a-f]{32}$/.test(quotationId)) return failure("not_found", 404);
    const result = await issueQuotation(store, admin, quotationId);
    if (!result.ok) return failure(result.code, result.code === "not_found" ? 404 : 409);
    return json({ ok: true, quotationNumber: result.quotation.quotationNumber });
  });
}
