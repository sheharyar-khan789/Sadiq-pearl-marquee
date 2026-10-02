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

// PLACEHOLDER — the production domain is UNRESOLVED (Phase 0 audit P0-1: this
// host does not currently resolve). It is kept in this one place so metadata,
// canonical URLs, sitemap, robots and structured data all change together.
// Do not replace it with a guess; update it once the client confirms the domain.
// Phase 10: the real domain can be set at build time with NEXT_PUBLIC_SITE_URL
// (e.g. "https://example.com", no trailing slash) without editing code.
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
export const siteUrl =
  configuredSiteUrl && /^https:\/\/[a-z0-9.-]+$/i.test(configuredSiteUrl) ? configuredSiteUrl : "https://www.sadiqpearlmarquee.com";

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

// ----------------------------------------------------------------------------
// CORE MEDIA PATHS — every path is a real, supplied asset under /public.
// Structure: images/{hero,exterior,interior,events,decoration,dining,gallery},
// videos/, menu/.
// ----------------------------------------------------------------------------
export const media = {
  logo: "/images/logo.jpg",
  hero: "/images/hero/hero-primary.jpg", // night facade still: desktop hero background
  // Real stage setup filmed at the venue (supplied 2026-09-29), re-encoded as a
  // seamless forward/reverse loop. Portrait 9:16: full-bleed hero film on phones,
  // arch-framed foreground film on desktop. One video per device.
  heroStageVideo: "/videos/stage-rose-arch.mp4",
  heroStagePoster: "/videos/stage-rose-arch-poster.jpg",
  daytimeFacade: "/images/exterior/exterior-daytime-facade.jpg",
  aerialVideo: "/videos/exterior-aerial.mp4",
  aerialPoster: "/videos/exterior-aerial-poster.jpg",
} as const;
