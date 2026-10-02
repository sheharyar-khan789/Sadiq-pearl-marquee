import type { Metadata } from "next";
import Link from "next/link";
import Gallery from "@/components/Gallery";
import DecorReels from "@/components/DecorReels";
import BookNowButton from "@/components/BookNowButton";
import Icon, { WhatsAppGlyph } from "@/components/Icon";
import { galleryItems } from "@/data/gallery";
import { business } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { breadcrumbJsonLd, jsonLdHtml, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Photo Gallery",
  description:
    "Real photographs of Sadiq Pearl Marquee in Kakrot, Sarai Alamgir: wedding stages, floral arches, chandelier halls, the entrance, exterior and dining.",
  path: "/gallery",
  image: {
    url: "/images/gallery/royal-stage.jpg",
    width: 1200,
    height: 1600,
    alt: "Wedding stage with gold sofas and a white floral canopy at Sadiq Pearl Marquee",
  },
});

// Matches the visible breadcrumb below.
const breadcrumb = jsonLdHtml(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Gallery", path: "/gallery" }]));

export default function GalleryPage() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I am browsing your gallery and would like to ask about date availability and venue setups."
  );

  return (
    <>
      <header className="bg-surface pb-10 pt-32 sm:pb-14 sm:pt-40">
        <div className="container-px mx-auto max-w-content">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-ink">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-ink">
                Gallery
              </li>
            </ol>
          </nav>
          <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">{galleryItems.length} photographs</p>
              <h1 className="mt-4 font-display text-[2.75rem] font-medium leading-[1.02] text-ink sm:text-6xl lg:text-7xl">
                The venue, <em className="text-gold">as it is</em>
              </h1>
              <p className="mt-5 text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
                Stage setups, interior halls, entrance, exterior and dining, photographed at {business.name} on
                Rashidpur–Orangabad Road, Kakrot.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <BookNowButton className="btn btn-primary">
                Book Your Event
                <Icon name="arrow" className="h-4 w-4" />
              </BookNowButton>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <WhatsAppGlyph className="h-[18px] w-[18px] text-gold" />
                WhatsApp
              </a>
            </div>
          </div>
        </div>
      </header>
      <Gallery variant="page" />
      {/* Real venue films (stages, entrance); load only when scrolled into view. */}
      <DecorReels />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
    </>
  );
}
