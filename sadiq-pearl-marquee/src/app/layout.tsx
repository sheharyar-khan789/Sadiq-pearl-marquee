import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { business, siteUrl } from "@/lib/config";
import { baseOpenGraph } from "@/lib/seo";

// Self-hosted at build time by next/font: no render-blocking third-party CSS.
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const defaultTitle = "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir";
const defaultDescription =
  "Sadiq Pearl Marquee is a wedding and event venue on Rashidpur–Orangabad Road, Kakrot, Sarai Alamgir, with in-house catering, table service, and free parking for weddings, mehndi, barat, walima and family celebrations.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: defaultTitle, template: "%s | Sadiq Pearl Marquee" },
  description: defaultDescription,
  applicationName: business.name,
  keywords: [
    "Sadiq Pearl Marquee",
    "wedding venue Sarai Alamgir",
    "marquee Kakrot",
    "shadi hall Sarai Alamgir",
    "mehndi venue",
    "walima venue",
  ],
  openGraph: baseOpenGraph,
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.ico" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#17120f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Marks JS as available before first paint so reveal styles apply without a flash. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="bg-surface font-body text-ink antialiased">{children}</body>
    </html>
  );
}
