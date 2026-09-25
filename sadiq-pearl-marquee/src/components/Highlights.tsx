import Image from "next/image";
import { highlights } from "@/data/highlights";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

export default function Highlights() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about Sadiq Pearl Marquee venue features and hosting an event."
  );

  return (
    <section id="features" className="bg-surface py-16 md:py-24 scroll-mt-20 border-b border-line/40">
      <span id="venue" className="sr-only" />
      <span id="highlights" className="sr-only" />

      <div className="max-w-content mx-auto container-px">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 sm:mb-16">
          <SectionHead
            eyebrow="Venue & Experience"
            title="Thoughtfully Appointed for Gracious Events"
            intro="Built on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir, every aspect of the marquee is designed to welcome family and friends in comfort."
          />
          <div className="lg:mb-14 shrink-0">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire on WhatsApp about venue features: 0345 5673921"
              className="inline-flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-12 px-6 rounded transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current" />
              <span>Inquire on WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Feature Story 1: Wide Editorial Spotlight (Image + 2 Core Pillars) */}
        <div className="bg-surface-low rounded-2xl border border-line/70 overflow-hidden shadow-sm grid lg:grid-cols-12 gap-0 items-stretch mb-8 sm:mb-10">
          {/* Real Interior Photography */}
          <div className="lg:col-span-7 relative min-h-[300px] sm:min-h-[400px] lg:min-h-[480px] bg-night">
            <Image
              src="/images/interior/interior-banquet-full.jpg"
              alt="Panoramic view of the banquet hall and seating arrangement inside Sadiq Pearl Marquee"
              fill
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-night/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <span className="text-[10px] uppercase tracking-widest text-gold-light font-semibold block mb-1">
                Main Banquet Hall
              </span>
              <p className="font-display text-lg sm:text-xl font-medium">
                Generous aisle and table seating for wedding &amp; reception gatherings
              </p>
            </div>
          </div>

          {/* Editorial Pillar Details */}
          <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between space-y-8 bg-surface-low">
            {/* Highlight 01 */}
            <div className="border-l-2 border-gold pl-5">
              <span className="font-display text-2xl text-gold font-semibold block mb-1">
                {highlights[0].number}
              </span>
              <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold mb-2">
                {highlights[0].title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                {highlights[0].description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gold">
                <Icon name="dining" className="w-3.5 h-3.5" />
                <span>Lunch &amp; Dinner Sessions</span>
              </div>
            </div>

            {/* Highlight 02 */}
            <div className="border-l-2 border-gold-container pl-5">
              <span className="font-display text-2xl text-gold-container font-semibold block mb-1">
                {highlights[1].number}
              </span>
              <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold mb-2">
                {highlights[1].title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                {highlights[1].description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-gold">
                <Icon name="groups" className="w-3.5 h-3.5" />
                <span>Comfortable for Large Groups &amp; Kids</span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Story 2: Complementary Architectural Duo (Cards with Real Media) */}
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* Card 1: Parking & Frontage */}
          <article className="bg-surface rounded-2xl border border-line/70 overflow-hidden shadow-sm flex flex-col group hover:border-gold/60 transition-colors">
            <div className="relative aspect-[16/10] bg-surface-high">
              <Image
                src="/images/exterior/exterior-daytime-facade.jpg"
                alt="Exterior daylight frontage and parking area at Sadiq Pearl Marquee on Rashidpur–Orangabad Road"
                fill
                sizes="(min-width: 768px) 48vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-4 left-4 bg-night/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow">
                <Icon name="parking" className="w-3.5 h-3.5 text-gold-light" />
                <span>On-Site &amp; Street</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <span className="font-display text-2xl text-gold font-semibold block mb-1">
                  {highlights[2].number}
                </span>
                <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold mb-2">
                  {highlights[2].title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {highlights[2].description} Arriving guests park with ease right in front of the venue.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/40 flex items-center justify-between text-xs text-ink-muted">
                <span>Rashidpur–Orangabad Road, Kakrot</span>
                <span className="font-semibold text-gold">Free of Charge</span>
              </div>
            </div>
          </article>

          {/* Card 2: Architectural Colonnade & Chandeliers */}
          <article className="bg-surface rounded-2xl border border-line/70 overflow-hidden shadow-sm flex flex-col group hover:border-gold/60 transition-colors">
            <div className="relative aspect-[16/10] bg-surface-high">
              <Image
                src="/images/decoration/decoration-chandelier-detail.jpg"
                alt="Detailed view of golden and crystal chandelier lighting inside Sadiq Pearl Marquee"
                fill
                sizes="(min-width: 768px) 48vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute top-4 left-4 bg-night/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs flex items-center gap-1.5 shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-light animate-pulse" />
                <span>Evening Ambiance</span>
              </div>
            </div>
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <span className="font-display text-2xl text-gold font-semibold block mb-1">
                  {highlights[3].number}
                </span>
                <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold mb-2">
                  {highlights[3].title}
                </h3>
                <p className="text-sm leading-relaxed text-ink-soft">
                  {highlights[3].description} Gilded chandeliers and tiered lighting create a warm, celebratory atmosphere.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-line/40 flex items-center justify-between text-xs text-ink-muted">
                <span>Illuminated Night Facade</span>
                <span className="font-semibold text-gold">Sarai Alamgir Landmark</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
