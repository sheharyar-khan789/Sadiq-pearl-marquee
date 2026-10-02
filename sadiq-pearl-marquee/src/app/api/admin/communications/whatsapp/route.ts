// POST /api/admin/communications/whatsapp
//   { bookingId, template, paymentId?, quotationId?, assignmentId?, requestKey, preview?: true }
// Super Admin only. Builds the message on the server from authoritative
// records. preview: returns the text only (nothing recorded). Otherwise the
// message is recorded as "initiated" + audited, and the wa.me link returned
// for the admin's browser to open. Delivery is NOT tracked or claimed: it
// happens inside WhatsApp. Never changes any booking / payment / document.
import { adminMutation, failure, json } from "@/lib/booking/admin-api";
import { initiateWhatsApp, previewWhatsApp, validateWhatsAppRequest } from "@/lib/booking/communications";
import { businessContact } from "@/lib/booking/communications-server";
import { rateLimit } from "@/lib/booking/rate-limit";
import { TEMPLATE_ERROR_MESSAGES } from "@/lib/booking/whatsapp-messages";

const MESSAGES: Record<string, string> = {
  ...TEMPLATE_ERROR_MESSAGES,
  record_not_found: "That payment, quotation or vendor assignment was not found for this booking.",
  phone_unusable: "The phone number on record isn't a usable WhatsApp number. Contact them another way or correct the number.",
  duplicate_request: "This form was already used for another message. Reload the page.",
  invalid_request_key: "Please reload the page and try again.",
};

export async function POST(request: Request) {
  return adminMutation(request, async ({ admin, store, body }) => {
    const preview = body.preview === true;
    const { preview: _p, ...rest } = body;
    void _p;
    const v = validateWhatsAppRequest(rest);
    if (!v.ok) return failure("invalid_request", 400);
    // Flood protection (per admin, per server instance).
    if (!rateLimit(`wa:${admin.uid}:${preview ? "p" : "i"}`, preview ? 60 : 20, 60_000).ok) {
      return json({ error: "rate_limited", message: "Too many messages in a short time. Please wait a minute." }, 429);
    }
    const business = businessContact();
    const r = preview ? await previewWhatsApp(store, v.value, business) : await initiateWhatsApp(store, admin, v.value, rest.requestKey, business);
    if (!r.ok) return json({ error: r.code, message: MESSAGES[r.code] ?? "The message could not be prepared." }, r.code === "not_found" || r.code === "record_not_found" ? 404 : 409);
    if (preview && "value" in r) return json({ ok: true, message: r.value.message, recipient: { kind: r.value.recipient.kind, name: r.value.recipient.name } });
    if ("communication" in r) {
      return json({ ok: true, url: r.url, communicationId: r.communication.communicationId, status: r.communication.status, replayed: r.replayed }, r.replayed ? 200 : 201);
    }
    return failure("invalid_request", 400);
  });
}
