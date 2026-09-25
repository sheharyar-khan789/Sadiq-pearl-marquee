"use client";

import Link from "next/link";
import { BookingProvider } from "@/components/BookingContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Gallery from "@/components/Gallery";
import WhatsAppButton from "@/components/WhatsAppButton";
import Icon, { WhatsAppGlyph } from "@/components/Icon";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { business } from "@/lib/config";

export default function GalleryPageClient() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I am browsing your gallery and would like to ask about date availability and venue setups."
  );

  return (
    <BookingProvider>
      <Navbar />
      <main className="pt-20 sm:pt-24 min-h-screen bg-surface">
        {/* Breadcrumb & Hero Header */}
        <div className="bg-surface-low border-b border-line/50 py-8 sm:py-12">
          <div className="max-w-content mx-auto container-px">
            <nav aria-label="Breadcrumbs" className="flex items-center gap-2 text-xs text-ink-muted mb-4">
              <Link href="/" className="hover:text-gold transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-ink font-semibold">Gallery</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="text-xs uppercase tracking-widest text-gold font-semibold block mb-2">
                  Official Venue Archive
                </span>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-ink font-semibold">
                  Photo Gallery &amp; Setups
                </h1>
                <p className="mt-3 text-sm sm:text-base text-ink-soft max-w-2xl leading-relaxed">
                  Real moments captured at {business.name} on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir.
                  Explore our stage decorations, interior halls, entrance foyers, and dining service.
                </p>
              </div>

              <div className="shrink-0">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Inquire on WhatsApp: 0345 5673921"
                  className="inline-flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-12 px-6 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  <WhatsAppGlyph className="w-4 h-4 fill-current" />
                  <span>Inquire on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Full Gallery */}
        <Gallery isDedicatedPage={true} />

        {/* Bottom CTA Banner */}
        <section className="bg-surface-mid/60 py-16 border-t border-line/40">
          <div className="max-w-content mx-auto container-px text-center">
            <span className="text-xs uppercase tracking-widest text-gold font-semibold block mb-2">
              Plan Your Celebration
            </span>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink font-semibold mb-3">
              Ready to See Sadiq Pearl in Person?
            </h2>
            <p className="text-sm sm:text-base text-ink-soft max-w-xl mx-auto mb-8 leading-relaxed">
              We welcome prospective families to visit the venue on Rashidpur–Orangabad Road, Kakrot,
              Sarai Alamgir. Contact us on WhatsApp to arrange a visit or ask about availability.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-12 px-7 rounded-xl transition-all shadow-md active:scale-95"
              >
                <WhatsAppGlyph className="w-4 h-4 fill-current" />
                <span>Inquire on WhatsApp (0345 5673921)</span>
              </a>
              <Link
                href="/#contact"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-line hover:border-gold text-ink font-semibold text-sm h-12 px-6 rounded-xl transition-colors bg-surface"
              >
                <Icon name="pin" className="w-4 h-4 text-gold" />
                <span>Get Directions &amp; Location</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </BookingProvider>
  );
}
