// Central SEO helpers (Phase 10). One place for: per-page metadata (title,
// description, canonical, Open Graph, Twitter), Schema.org structured data,
// and the list of private paths kept out of search engines.
//
// Only real, configured business information is used. Values that are not
// known (opening hours, price range, coordinates, awards, ratings of our own)
// are simply omitted — never guessed.
import type { Metadata } from "next";
import { business, media, siteUrl } from "./config";

// Next.js replaces (does not merge) a parent's `openGraph` object when a page
// defines its own, so every page spreads these shared fields in.
export const baseOpenGraph = {
  siteName: business.name,
  locale: "en_PK",
  type: "website" as const,
};

export interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/** The default share image: the real night facade photo. */
export const DEFAULT_OG_IMAGE: SeoImage = {
  url: media.hero,
  width: 1024,
  height: 576,
  alt: `${business.name} illuminated facade at night`,
};

/**
 * Metadata for an indexable public page. `path` is the canonical path
 * (no query string, no trailing slash except "/").
 */
export function pageMetadata(opts: { title: string; description: string; path: string; image?: SeoImage; absoluteTitle?: boolean }): Metadata {
  const image = opts.image ?? DEFAULT_OG_IMAGE;
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} | ${business.name}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: { ...baseOpenGraph, title: fullTitle, description: opts.description, url: opts.path, images: [image] },
    twitter: { card: "summary_large_image", title: fullTitle, description: opts.description, images: [image.url] },
  };
}

/**
 * Paths that are never for search engines: customer account, admin, sign-in
 * flows and APIs. Used by robots.txt (these pages also send noindex).
 */
export const PRIVATE_PATHS = ["/admin", "/account", "/api/", "/login", "/signup", "/forgot-password", "/auth/"] as const;

const abs = (path: string) => new URL(path, siteUrl).toString();

/** Schema.org EventVenue for the business — factual fields only. */
export function venueJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    "@id": `${abs("/")}#venue`,
    name: business.name,
    url: abs("/"),
    image: abs(media.hero),
    logo: abs(media.logo),
    telephone: business.phones.map((p) => p.href.replace("tel:", "")),
    address: {
      "@type": "PostalAddress",
      streetAddress: business.addressLine1,
      addressLocality: "Sarai Alamgir",
      addressCountry: "PK",
    },
    hasMap: business.googleMapsUrl,
    sameAs: [business.social.tiktok, business.social.instagram, business.social.facebook].filter(Boolean),
    // No aggregateRating: the only ratings are Google's (third-party); review
    // markup on our own pages must come from reviews actually shown and approved.
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${abs("/")}#website`,
    name: business.name,
    url: abs("/"),
    publisher: { "@id": `${abs("/")}#venue` },
    inLanguage: "en-PK",
  };
}

/** BreadcrumbList that matches the visible breadcrumb on the page. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

/** Safe JSON-LD for a <script> tag ("<" escaped so data can never close the tag). */
export const jsonLdHtml = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
