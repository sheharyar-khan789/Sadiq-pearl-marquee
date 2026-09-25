import Image from "next/image";
import { eventCategories } from "@/data/events";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

interface EventVisual {
  src: string;
  alt: string;
}

const eventMedia: Record<string, EventVisual> = {
  weddings: {
    src: "/images/gallery/royal-stage.jpg",
    alt: "Grand decorated wedding stage with golden seating and floral canopy at Sadiq Pearl Marquee",
  },
  mehndi: {
    src: "/images/gallery/chandelier-arch.jpg",
    alt: "Floral arch and celebratory chandelier setting for Mehndi celebrations",
  },
  barat: {
    src: "/images/gallery/entrance-arch.jpg",
    alt: "Floral entrance arch prepared for arriving Barat procession and guests",
  },
  walima: {
    src: "/images/interior/interior-banquet-full.jpg",
    alt: "Banquet dining arrangement with table service for Walima reception",
  },
  engagement: {
    src: "/images/events/event-stage-arch.jpg",
    alt: "Stage arch backdrop for family engagement and ring ceremonies",
  },
  family: {
    src: "/images/interior/interior-vip-lounge.jpg",
    alt: "Comfortable lounge and seating for family celebrations and reunions",
  },
};

export default function Events() {
  const events = eventCategories.filter((e) => e.enabled);

  return (
    <section id="events" className="bg-surface-mid/60 py-16 md:py-24 scroll-mt-20 border-b border-line/40">
      <div className="max-w-content mx-auto container-px">
        {/* Header with Direct WhatsApp Inquiries */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 sm:mb-16">
          <SectionHead
            eyebrow="Occasions & Celebrations"
            title="A Setting for Every Family Milestone"
            intro="From lively mehndi nights and grand barat receptions to intimate family gatherings, Sadiq Pearl Marquee provides the atmosphere and hospitality to honor your special day."
          />
          <div className="lg:mb-14 shrink-0">
            <a
              href={getWhatsAppUrl("Assalam o Alaikum, I would like to inquire about hosting an event at Sadiq Pearl Marquee.")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire about event availability on WhatsApp: 0345 5673921"
              className="inline-flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-12 px-6 rounded transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current" />
              <span>Inquire for Your Date</span>
            </a>
          </div>
        </div>

        {/* 6 Confirmed Event Type Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {events.map((e) => {
            const media = eventMedia[e.slug] ?? eventMedia.weddings;
            const eventWhatsAppUrl = getWhatsAppUrl(
              `Assalam o Alaikum, I am interested in booking Sadiq Pearl Marquee for a ${e.title} event. Please share availability.`
            );

            return (
              <article
                key={e.slug}
                className="bg-surface rounded-2xl overflow-hidden border border-line/70 hover:border-gold/60 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  {/* Real Event Photo */}
                  <div className="relative aspect-[16/11] bg-surface-high overflow-hidden">
                    <Image
                      src={media.src}
                      alt={media.alt}
                      fill
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 48vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-night/60 via-transparent to-transparent pointer-events-none" />
                    {e.urduLabel && (
                      <div className="absolute bottom-3 right-4">
                        <span
                          lang="ur"
                          dir="rtl"
                          className="font-semibold text-gold-light text-base drop-shadow"
                        >
                          {e.urduLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-6 sm:p-7">
                    <div className="flex items-baseline justify-between gap-2 mb-2">
                      <h3 className="font-display text-xl sm:text-2xl text-ink font-semibold">
                        {e.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {e.description}
                    </p>
                  </div>
                </div>

                {/* Card Action: WhatsApp Inquiry */}
                <div className="px-6 pb-6 pt-0 sm:px-7 sm:pb-7">
                  <a
                    href={eventWhatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Inquire about ${e.title} on WhatsApp: 0345 5673921`}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-gold/40 hover:border-gold text-gold hover:bg-gold hover:text-white transition-colors text-xs sm:text-sm font-semibold"
                  >
                    <WhatsAppGlyph className="w-4 h-4 fill-current" />
                    <span>Inquire for {e.title}</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
