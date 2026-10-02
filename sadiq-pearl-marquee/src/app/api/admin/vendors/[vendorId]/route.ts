// POST /api/admin/vendors/{id}
//   { action: "update", name, category, phone, whatsapp?, email?, notes?, expectedUpdatedAt? }
//   { action: "activate" | "deactivate", expectedUpdatedAt? }
// Super Admin only. Vendors are never deleted (assignment history refers to them).
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { updateVendor, validateVendorInput } from "@/lib/booking/operations";

export async function POST(request: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  return adminMutation(request, async ({ admin, store, body }) => {
    if (!/^vd_[0-9a-f]{20}$/.test(vendorId)) return failure("not_found", 404);
    const expectedUpdatedAt = typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined;
    let change: Parameters<typeof updateVendor>[3];
    if (body.action === "update") {
      const { action: _a, expectedUpdatedAt: _e, ...fields } = body;
      void _a;
      void _e;
      const v = validateVendorInput(fields);
      if (!v.ok) {
        const first = Object.values(v.errors)[0]?.message;
        return json({ error: "invalid_vendor", message: first ?? "Please correct the vendor details.", fields: v.errors }, 400);
      }
      change = { details: v.value, expectedUpdatedAt };
    } else if (body.action === "activate" || body.action === "deactivate") {
      change = { active: body.action === "activate", expectedUpdatedAt };
    } else return failure("invalid_action", 400);
    const r = await updateVendor(store, admin, vendorId, change);
    if (!r.ok) return failure(r.code, r.code === "not_found" ? 404 : 409);
    return json({ ok: true });
  });
}
