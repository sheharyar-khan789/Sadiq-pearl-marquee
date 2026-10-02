import { business } from "./config";

// Single source: business.whatsappNumber in config.ts ("923455673921").
export const WHATSAPP_INTL_NUMBER = business.whatsappNumber as string;
export const WHATSAPP_RAW_NUMBER = `0${WHATSAPP_INTL_NUMBER.slice(2)}`; // 03455673921
export const WHATSAPP_DISPLAY_NUMBER = WHATSAPP_RAW_NUMBER.replace(/(\d{4})(\d+)/, "$1 $2"); // 0345 5673921

export const DEFAULT_WHATSAPP_MESSAGE =
  "Assalam o Alaikum, I am interested in Sadiq Pearl Marquee and would like to ask about booking availability.";

/**
 * Builds a properly URL-encoded wa.me link with the verified WhatsApp number (03455673921)
 * and a pre-filled professional inquiry message.
 */
export function getWhatsAppUrl(customMessage: string = DEFAULT_WHATSAPP_MESSAGE): string {
  return `https://wa.me/${WHATSAPP_INTL_NUMBER}?text=${encodeURIComponent(customMessage)}`;
}
