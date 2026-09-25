// ============================================================================
// CENTRAL BUSINESS CONFIGURATION
// ----------------------------------------------------------------------------
// Edit this file to update business-wide information across the entire site.
// Do not hardcode business details anywhere else — import from here instead.
//
// CONTENT STATUS KEY (see comments on each field):
//   CONFIRMED   -> verified from the client / Google Business Profile
//   PLACEHOLDER -> safe default, easy to edit, not presented as verified fact
// ============================================================================

export interface PhoneEntry {
  display: string;
  href: string;
}

function toPhone(raw: string): PhoneEntry {
  return { display: raw.replace(/(\d{4})(\d+)/, "$1 $2"), href: `tel:${raw}` };
}

export const business = {
  // CONFIRMED
  name: "Sadiq Pearl Marquee",
  shortName: "Sadiq Pearl",
  tagline: "Where Your Special Moments Become Unforgettable",

  // CONFIRMED — three current business numbers. First is used as the
  // "primary" number for compact UI (e.g. footer summary line); all three
  // are rendered wherever the design has room (Location section).
  phones: [
    toPhone("03435426640"),
    toPhone("03009524371"),
    toPhone("03455673921"),
  ] as PhoneEntry[],
  get phoneDisplay() {
    return this.phones[0].display;
  },
  get phoneHref() {
    return this.phones[0].href;
  },

  // CONFIRMED by the client — all three numbers above are on WhatsApp.
  // This one receives inquiries. International format, no "+".
  whatsappNumber: "923455673921" as string | null,
  get whatsappHref() {
    return this.whatsappNumber ? `https://wa.me/${this.whatsappNumber}` : null;
  },

  // CONFIRMED
  addressLine1: "Rashidpur–Orangabad Road",
  addressLine2: "Kakrot, Sarai Alamgir, Pakistan",
  get fullAddress() {
    return `${this.addressLine1}, ${this.addressLine2}`;
  },

  // CONFIRMED (Google Business Profile, captured 2026)
  rating: 4.4,
  reviewCount: 8,

  // CONFIRMED — exact client-provided Google Maps share link
  googleMapsUrl: "https://maps.app.goo.gl/zSqTBqc7MidRtrfe8?g_st=ac",

  // tiktok CONFIRMED; instagram/facebook remain null until confirmed (hidden, not invented)
  social: {
    instagram: null as string | null,
    facebook: null as string | null,
    tiktok: "https://www.tiktok.com/@sadiq.pearl.marquee" as string | null,
    tiktokHandle: "@sadiq.pearl.marquee",
  },

  copyrightYear: new Date().getFullYear(),
};

// CONFIRMED — Google Business Profile "About" features (see reference screenshots)
export const venueFeatures = [
  "Dine-in",
  "Solo dining",
  "Small plates",
  "Lunch",
  "Dinner",
  "Table service",
  "Casual atmosphere",
  "Good for groups",
  "Good for kids",
  "Free street parking",
  "Free parking lot",
];

// PLACEHOLDER — editable event-type options shown in the booking form.
// Remove or rename any option that doesn't apply once the client confirms.
export const eventTypeOptions = [
  "Wedding (Shadi)",
  "Nikkah",
  "Mehndi",
  "Barat",
  "Walima",
  "Engagement",
  "Family Gathering",
  "Other",
];

// CONFIRMED session names (Lunch / Dinner). Timings are NOT published because they are unconfirmed.
// PLACEHOLDER — session options, matches confirmed "Lunch"/"Dinner" dining options
export const sessionOptions = ["Lunch", "Dinner"] as const;

// PLACEHOLDER — guest-count brackets are about the customer's own party size,
// not a stated venue capacity. Adjust freely.
export const guestOptions = [
  "Under 100 Guests",
  "100 – 250 Guests",
  "250 – 500 Guests",
  "500+ Guests",
];

// ----------------------------------------------------------------------------
// CORE MEDIA PATHS — every path is a real, supplied asset under /public.
// Structure: images/{hero,exterior,interior,events,decoration,dining,gallery},
// videos/, menu/.
// ----------------------------------------------------------------------------
export const media = {
  logo: "/images/logo.jpg",
  hero: "/images/hero/hero-primary.jpg", // also the poster for the hero video
  heroVideo: "/videos/hero-exterior.mp4",
  daytimeFacade: "/images/exterior/exterior-daytime-facade.jpg",
} as const;
