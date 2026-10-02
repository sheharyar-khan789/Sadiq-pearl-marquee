// POST /api/admin/settings — change the business configuration.
// body: { section, op?, id?, data, expectedVersion? }
// Super Admin only (server-verified). Strictly validated; stale edits are
// rejected; the change and its audit record are written in one transaction.
// Existing bookings are never modified by a configuration change.
import { adminMutation, json } from "@/lib/booking/admin-api";
import { mutateConfig, type ConfigChange } from "@/lib/config/config-admin";
import { invalidatePublicConfig } from "@/lib/config/config-server";

const ALLOWED = new Set(["section", "op", "id", "data", "expectedVersion"]);

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const unknown = Object.keys(body).filter((k) => !ALLOWED.has(k));
    if (unknown.length || typeof body.section !== "string") {
      return json({ error: "invalid_request", message: "The request could not be read." }, 400);
    }
    const change: ConfigChange = {
      section: body.section,
      op: typeof body.op === "string" ? body.op : undefined,
      id: typeof body.id === "string" ? body.id : undefined,
      data: body.data,
      expectedVersion: typeof body.expectedVersion === "number" ? body.expectedVersion : undefined,
    };
    const result = await mutateConfig(store, admin, change);
    if (!result.ok) {
      if (result.code === "stale") {
        return json({ error: "stale", message: "Someone saved this item after you opened it. Reload to see the latest values, then try again." }, 409);
      }
      if (result.code === "not_found") return json({ error: "not_found", message: "That item no longer exists." }, 404);
      if (result.code === "duplicate_id") return json({ error: "duplicate_id", message: result.message }, 409);
      return json({ error: "invalid", message: "Please correct the highlighted fields.", fields: result.errors ?? {} }, 400);
    }
    invalidatePublicConfig();
    return json({ ok: true, entityId: result.entityId, configVersion: result.config.version });
  });
}
