// ============================================================================
// OFFICIAL VENUE TERMS ("شرائط و ضوابط") — single source.
// ----------------------------------------------------------------------------
// The venue's own printed policy card, translated from Urdu. Shown on the
// public "Booking terms" sheet, in the booking review, on the customer's
// booking page, in Admin → Settings → Policies (read-only) and copied into
// every NEW quotation (historical quotations keep what they were issued with).
//
// Pricing values on the card are NOT calculated from this text: the guest
// surcharge (below 300 guests, Rs 300 per guest) and the 5% service charge are
// the business configuration's `pricing.smallEventSurcharge` /
// `pricing.serviceChargePercent`, applied by the one pricing engine (quote()).
// AC / extra-time charges are per hour, which the pricing engine has no unit
// for, so they are stated here only (see SADIQ_PEARL_OFFICIAL_POLICIES.md).
// Do not add or reword a term without the venue's confirmation.
// Pure data: safe for server and client code.
// ============================================================================

export interface VenueTerm {
  title: string;
  body: string;
}

export const OFFICIAL_VENUE_TERMS: VenueTerm[] = [
  { title: "Minimum guests", body: "All services are for a minimum of 300 guests. For fewer guests, an extra Rs. 300 per head is charged." },
  { title: "Outside catering & decoration", body: "Catering or decoration from outside is strictly not allowed." },
  { title: "Cleanliness & breakage", body: "Responsibility for cleanliness and for any breakage rests with the customer." },
  { title: "Your belongings", body: "During the function and when leaving the hall, you are responsible for keeping your valuables safe." },
  { title: "AC charges", body: "AC charges are Rs. 20,000 for one hour." },
  { title: "Fireworks & firing", body: "Fireworks and firing are strictly prohibited. The person who books the hall is fully responsible for any violation." },
  { title: "Service charges & extra time", body: "5% service charges apply. Extra time is charged at Rs. 20,000 per hour." },
  { title: "Extra services", body: "Extra decoration, extra lighting, sound system and other extra services are charged separately." },
  { title: "Taxes & advance", body: "All government taxes and regulations apply to the customer. The advance amount is non-refundable." },
];
