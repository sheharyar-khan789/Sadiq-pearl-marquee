// POST /api/admin/vendors  { name, category, phone, whatsapp?, email?, notes?, requestKey }
// Super Admin only. Adds a vendor ENTERED BY THE ADMIN (no vendors are pre-filled).
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { createVendor, validateVendorInput } from "@/lib/booking/operations";

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const v = validateVendorInput(body, ["requestKey"]);
    if (!v.ok) {
      const first = Object.values(v.errors)[0]?.message;
      return json({ error: "invalid_vendor", message: first ?? "Please correct the vendor details.", fields: v.errors }, 400);
    }
    const r = await createVendor(store, admin, v.value, body.requestKey);
    if (!r.ok) return failure(r.code, r.code === "invalid_request_key" ? 400 : 409);
    return json({ ok: true, vendorId: r.vendor.vendorId, replayed: !!r.replayed }, r.replayed ? 200 : 201);
  });
}
