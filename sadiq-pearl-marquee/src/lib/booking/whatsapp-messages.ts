// Manual WhatsApp messages (Phase 9) — the ONE place staff message text is built.
// Every template receives authoritative records (booking, payment, quotation,
// vendor assignment) and never invents a value: missing data is omitted or
// shown as "Pending". Links are always https://wa.me/<digits>?text=<encoded>;
// no other URL is ever produced (no open redirect).
import { formatEventDate, formatPKR } from "./format.ts";
import { financialSummary } from "./finance-model.ts";
import type { PaymentRecord, QuotationRecord } from "./finance-model.ts";
import { bookingReference, type BookingRecord } from "./model.ts";
import { PAYMENT_METHOD_LABELS } from "./finance-model.ts";
import type { WhatsAppTemplate } from "./notifications.ts";

/**
 * Normalises a Pakistani phone number to international digits for wa.me:
 * "0300 1234567" / "+92 300 1234567" / "92-300-1234567" -> "923001234567".
 * Returns null for anything that isn't clearly a valid number (never guesses).
 */
export function normalizeWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\+?[0-9 ()-]{7,24}$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `92${digits.slice(1)}`;
  // Pakistan mobile: 92 + 3xx + 7 digits. Other international numbers: 8–15 digits, no leading 0.
  if (digits.startsWith("92")) return /^923\d{9}$/.test(digits) ? digits : null;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** The only URL form ever produced. */
export function whatsAppLink(number: string, message: string): string {
  if (!/^[1-9]\d{7,14}$/.test(number)) throw new Error("Invalid WhatsApp number");
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export interface BusinessContact {
  name: string;
  phones: string[];
}

type Booking = BookingRecord;

const header = (b: Booking, business: BusinessContact) =>
  [`Assalam o Alaikum ${b.customer.name || ""}`.trim() + ",", "", `This is ${business.name}.`];

const eventLines = (b: Booking) => [
  `Reference: ${bookingReference(b.bookingId)}`,
  `Date: ${formatEventDate(b.eventDate)}`,
  `Slot: ${b.slotLabel}`,
  `Hall: ${b.hallName}`,
  `Event: ${b.eventTypeLabel}`,
  `Guests: ${b.guestCount.toLocaleString("en-US")}`,
];

const balanceLines = (b: Booking) => {
  const f = financialSummary(b);
  if (f.total === null) return ["Price: Pending (our team will confirm it with you)"];
  return [`Total: ${formatPKR(f.total)}`, `Paid: ${formatPKR(f.paid)}`, `Remaining: ${formatPKR(f.remaining ?? 0)}`];
};

const footer = (business: BusinessContact) => ["", "Thank you.", business.name];

export type TemplateInput =
  | { template: "booking_confirmation"; booking: Booking }
  | { template: "payment_confirmation"; booking: Booking; payment: PaymentRecord }
  | { template: "quotation"; booking: Booking; quotation: QuotationRecord }
  | { template: "event_reminder"; booking: Booking }
  | { template: "general"; booking: Booking }
  | { template: "vendor_event_details"; booking: Booking; vendorName: string; category: string };

export type TemplateError = "booking_not_confirmed" | "payment_not_recorded" | "quotation_not_issued" | "event_not_upcoming" | "booking_mismatch";

/** Builds the message text, or explains why this template doesn't apply to the real data. */
export function buildWhatsAppMessage(input: TemplateInput, business: BusinessContact, today: string): { ok: true; message: string } | { ok: false; code: TemplateError } {
  const b = input.booking;
  switch (input.template) {
    case "booking_confirmation":
      if (b.status !== "confirmed") return { ok: false, code: "booking_not_confirmed" };
      return {
        ok: true,
        message: [...header(b, business), "", "Your booking is confirmed:", ...eventLines(b), ...balanceLines(b), "", "You can see your booking, quotation and receipts in your account on our website.", ...footer(business)].join("\n"),
      };
    case "payment_confirmation": {
      const p = input.payment;
      if (p.bookingId !== b.bookingId) return { ok: false, code: "booking_mismatch" };
      if (p.status !== "recorded") return { ok: false, code: "payment_not_recorded" };
      return {
        ok: true,
        message: [
          ...header(b, business),
          "",
          `We have recorded your payment for booking ${bookingReference(b.bookingId)}:`,
          `Amount: ${formatPKR(p.amount)}`,
          `Method: ${PAYMENT_METHOD_LABELS[p.method]}`,
          `Receipt: ${p.receipt.receiptNumber}`,
          `Remaining after this payment: ${formatPKR(p.receipt.remainingAfter)}`,
          "",
          "Your receipt can be downloaded from your account on our website.",
          ...footer(business),
        ].join("\n"),
      };
    }
    case "quotation": {
      const q = input.quotation;
      if (q.bookingId !== b.bookingId) return { ok: false, code: "booking_mismatch" };
      if (q.status !== "issued" || !q.quotationNumber) return { ok: false, code: "quotation_not_issued" };
      return {
        ok: true,
        message: [
          ...header(b, business),
          "",
          `Your quotation ${q.quotationNumber} for booking ${bookingReference(b.bookingId)} is ready.`,
          `Total: ${formatPKR(q.snapshot.pricing.total)}`,
          q.snapshot.requiredAdvance !== null ? `Required advance: ${formatPKR(q.snapshot.requiredAdvance)}` : "Required advance: Pending",
          "",
          "You can download it from your account on our website.",
          ...footer(business),
        ].join("\n"),
      };
    }
    case "event_reminder":
      if (b.status !== "confirmed") return { ok: false, code: "booking_not_confirmed" };
      if (b.eventDate < today) return { ok: false, code: "event_not_upcoming" };
      return { ok: true, message: [...header(b, business), "", "A reminder about your upcoming event:", ...eventLines(b), ...balanceLines(b), ...footer(business)].join("\n") };
    case "general":
      return { ok: true, message: [...header(b, business), "", `About your booking ${bookingReference(b.bookingId)} (${formatEventDate(b.eventDate)}, ${b.slotLabel}):`, "", ...footer(business)].join("\n") };
    case "vendor_event_details":
      // Vendor messages carry event logistics only: no customer phone, email or money.
      if (b.status !== "confirmed") return { ok: false, code: "booking_not_confirmed" };
      return {
        ok: true,
        message: [
          `Assalam o Alaikum ${input.vendorName},`,
          "",
          `This is ${business.name}. Event details for your ${input.category} booking with us:`,
          `Reference: ${bookingReference(b.bookingId)}`,
          `Date: ${formatEventDate(b.eventDate)}`,
          `Slot: ${b.slotLabel}`,
          `Hall: ${b.hallName}`,
          `Event: ${b.eventTypeLabel}`,
          `Guests: ${b.guestCount.toLocaleString("en-US")}`,
          ...footer(business),
        ].join("\n"),
      };
  }
}

export const TEMPLATE_ERROR_MESSAGES: Readonly<Record<TemplateError, string>> = {
  booking_not_confirmed: "This message is only for confirmed bookings.",
  payment_not_recorded: "Choose a recorded (not voided) payment.",
  quotation_not_issued: "Only an issued quotation can be sent.",
  event_not_upcoming: "This event is not upcoming.",
  booking_mismatch: "That record belongs to another booking.",
};

/** Customer -> venue support message (customer portal), with real booking context only. */
export function supportMessage(b: Pick<BookingRecord, "bookingId" | "eventDate" | "slotLabel">): string {
  return `Assalam o Alaikum, I have a question about my booking ${bookingReference(b.bookingId)} on ${b.eventDate} (${b.slotLabel} slot).`;
}

export type { WhatsAppTemplate };
