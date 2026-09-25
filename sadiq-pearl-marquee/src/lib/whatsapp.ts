import { business } from "./config";

export const WHATSAPP_RAW_NUMBER = "03455673921";
export const WHATSAPP_INTL_NUMBER = "923455673921";
export const WHATSAPP_DISPLAY_NUMBER = "0345 5673921";

export const DEFAULT_WHATSAPP_MESSAGE =
  "Assalam o Alaikum, I am interested in Sadiq Pearl Marquee and would like to ask about booking availability.";

/**
 * Builds a properly URL-encoded wa.me link with the verified WhatsApp number (03455673921)
 * and a pre-filled professional inquiry message.
 */
export function getWhatsAppUrl(customMessage: string = DEFAULT_WHATSAPP_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_INTL_NUMBER}?text=${encodeURIComponent(customMessage)}`;
}

export interface BookingDetails {
  name: string;
  phone: string;
  eventType: string;
  date: string;
  guests: string;
  session?: string;
  menu?: string;
  message?: string;
  requests?: string;
}

/**
 * Constructs the structured, verified WhatsApp inquiry message.
 */
function buildMessage(details: BookingDetails): string {
  const customNote = details.message?.trim() || details.requests?.trim();

  const lines = [
    `Hello ${business.name},`,
    "",
    "I would like to inquire about an event.",
    "",
    `Name: ${details.name.trim()}`,
    `Phone: ${details.phone.trim()}`,
    `Event Type: ${details.eventType}`,
    `Preferred Date: ${details.date}`,
    `Expected Guests: ${details.guests}`,
  ];

  if (details.session) {
    lines.push(`Session: ${details.session}`);
  }
  if (details.menu && details.menu !== "Not decided yet") {
    lines.push(`Menu Interest: ${details.menu}`);
  }
  if (customNote) {
    lines.push(`Message: ${customNote}`);
  }

  lines.push("", "Thank you.");
  return lines.join("\n");
}

/**
 * Builds a properly URL-encoded wa.me link pre-filled with the event inquiry.
 */
export function buildWhatsAppUrl(details: BookingDetails): string {
  const message = buildMessage(details);
  return getWhatsAppUrl(message);
}

/**
 * Fallback for when SMS is needed.
 */
export function buildSmsUrl(details: BookingDetails): string {
  const message = buildMessage(details);
  return `sms:${WHATSAPP_RAW_NUMBER}?body=${encodeURIComponent(message)}`;
}
