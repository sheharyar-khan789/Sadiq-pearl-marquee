import type { Metadata, Viewport } from "next";
import "./globals.css";
import { business } from "@/lib/config";

const siteUrl = "https://www.sadiqpearlmarquee.com"; // PLACEHOLDER — set the real production domain

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir",
    template: "%s | Sadiq Pearl Marquee",
  },
  description:
    "Sadiq Pearl Marquee is a wedding and event venue on Rashidpur–Orangabad Road, Kakrot, Sarai Alamgir. Table service dining, free parking, and space for weddings, mehndi, barat, walima and family celebrations.",
  keywords: [
    "Sadiq Pearl Marquee",
    "wedding venue Sarai Alamgir",
    "marquee Kakrot",
    "event venue Pakistan",
    "shadi hall Sarai Alamgir",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir",
    description:
      "A wedding and event venue in Kakrot, Sarai Alamgir with table service dining, free parking, and space for weddings, mehndi, barat and family celebrations.",
    url: siteUrl,
    siteName: business.name,
    images: [
      {
        url: "/images/hero/hero-primary.jpg",
        width: 1024,
        height: 576,
        alt: "Sadiq Pearl Marquee illuminated facade at night",
      },
    ],
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir",
    description:
      "A wedding and event venue in Kakrot, Sarai Alamgir with table service dining, free parking, and space for celebrations.",
    images: ["/images/hero/hero-primary.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#fcf9f5",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EventVenue",
  name: business.name,
  image: `${siteUrl}/images/hero/hero-primary.jpg`,
  telephone: business.phoneDisplay,
  address: {
    "@type": "PostalAddress",
    streetAddress: business.addressLine1,
    addressLocality: "Sarai Alamgir",
    addressCountry: "PK",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: business.rating,
    reviewCount: business.reviewCount,
  },
  url: siteUrl,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-body antialiased bg-surface text-ink">{children}</body>
    </html>
  );
}
