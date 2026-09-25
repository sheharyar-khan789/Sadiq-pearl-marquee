import Image from "next/image";
import { business, venueFeatures } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { Stars, WhatsAppGlyph } from "./Icon";

export default function About() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to learn more about hosting an event at Sadiq Pearl Marquee."
  );

  return (
    <section id="about" className="bg-surface-low py-16 md:py-24 scroll-mt-20 border-b border-line/40">
      <div className="max-w-content mx-auto container-px">
        {/* Top Editorial Row */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 xl:gap-16 items-center">
          {/* Left Column: Story & Confirmed Information */}
          <div className="lg:col-span-6 flex flex-col justify-center">
            <SectionHead
              eyebrow="About Sadiq Pearl Marquee"
              title="An Architectural Setting Crafted for Cherished Celebrations"
              intro={`Prominently located on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir, ${business.name} brings together grand architecture, sparkling crystal chandeliers, and warm Pakistani hospitality.`}
            />

            <p className="mt-4 text-base sm:text-lg leading-relaxed text-ink-soft">
              Every detail—from the welcoming entrance colonnade and illuminated evening facade
              to the spacious banquet hall and attentive table service—is tailored to make your wedding,
              mehndi, barat, walima, or family gathering feel effortless and dignified.
            </p>

            {/* Confirmed Google Verified Rating Badge */}
            <div className="mt-6 flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface border border-line/70 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Stars value={business.rating} className="w-4 h-4 text-gold" />
                <span className="font-display font-semibold text-lg text-ink ml-1">{business.rating}</span>
                <span className="text-xs text-ink-muted">/ 5</span>
              </div>
              <span className="text-line-strong text-xs hidden sm:inline">|</span>
              <p className="text-xs text-ink-soft">
                Based on <strong className="text-ink font-semibold">{business.reviewCount} verified Google reviews</strong> from attending families
              </p>
            </div>

            {/* Confirmed Venue Features Pills */}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wider font-semibold text-gold mb-3">
                Confirmed Venue Amenities
              </p>
              <ul className="flex flex-wrap gap-2" aria-label="Confirmed venue amenities">
                {venueFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="text-xs sm:text-sm font-medium text-ink-soft border border-line/80 rounded-full px-3.5 py-1.5 bg-surface hover:border-gold/60 transition-colors"
                  >
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Inquire CTA */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Inquire on WhatsApp about Sadiq Pearl Marquee: 0345 5673921"
                className="inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-12 px-6 rounded transition-all shadow-sm"
              >
                <WhatsAppGlyph className="w-4 h-4 fill-current" />
                <span>Inquire on WhatsApp</span>
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded border border-line hover:border-gold text-ink font-semibold text-sm transition-colors"
              >
                <span>View Venue Features</span>
                <Icon name="arrow" className="w-4 h-4 text-gold" />
              </a>
            </div>
          </div>

          {/* Right Column: Editorial Dual Image Composition */}
          <div className="lg:col-span-6">
            <div className="grid grid-cols-12 gap-4 sm:gap-6 items-end">
              {/* Primary Large Image */}
              <div className="col-span-7 relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl ring-1 ring-gold/20 bg-surface-high">
                <Image
                  src="/images/gallery/crystal-hall.jpg"
                  alt="Crystal chandeliers and illuminated hall decor inside Sadiq Pearl Marquee"
                  fill
                  sizes="(min-width: 1024px) 35vw, (min-width: 640px) 55vw, 65vw"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-night/80 via-night/30 to-transparent text-white">
                  <span className="text-[10px] uppercase tracking-widest text-gold-light font-semibold block">Interior Hall</span>
                  <p className="font-display text-sm sm:text-base font-medium">Crystal chandeliers &amp; table settings</p>
                </div>
              </div>

              {/* Secondary Supporting Image */}
              <div className="col-span-5 flex flex-col gap-4">
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-md ring-1 ring-gold/15 bg-surface-high">
                  <Image
                    src="/images/gallery/entrance-lobby.jpg"
                    alt="Welcoming entrance lobby at Sadiq Pearl Marquee"
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 35vw, 40vw"
                    className="object-cover transition-transform duration-700 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-night/75 to-transparent text-white">
                    <span className="text-[9px] uppercase tracking-wider text-gold-light font-semibold block">Entrance</span>
                    <p className="font-display text-xs sm:text-sm font-medium">Lobby &amp; reception area</p>
                  </div>
                </div>

                {/* Architectural note box */}
                <div className="p-4 rounded-xl bg-surface border border-line/70 text-ink-soft">
                  <p className="font-display text-lg text-gold font-semibold mb-1">Kakrot</p>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    Sarai Alamgir, Punjab. Easily accessible with free frontage parking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Core Experience Pillars (Light, Editorial, Warm) */}
        <div className="mt-14 sm:mt-18 grid md:grid-cols-3 gap-6">
          <div className="bg-surface rounded-xl border border-line/70 p-6 sm:p-7 transition-all hover:border-gold/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-surface-mid grid place-items-center mb-4 text-gold">
                <Icon name="dining" className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl text-ink font-semibold mb-2">
                Gracious Table Service
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                Guests enjoy dedicated table service at both lunch and dinner sessions. Warm,
                fresh dishes and beverages are served directly to each table for a refined dining experience.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-line/40 text-xs font-semibold uppercase tracking-wider text-gold">
              Lunch &amp; Dinner Available
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-line/70 p-6 sm:p-7 transition-all hover:border-gold/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-surface-mid grid place-items-center mb-4 text-gold">
                <Icon name="groups" className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl text-ink font-semibold mb-2">
                Built for Multi-Gen Families
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                A comfortable, hospitable atmosphere designed for large extended families, elders, and
                young children alike to gather, converse, and celebrate together with dignity.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-line/40 text-xs font-semibold uppercase tracking-wider text-gold">
              Good for Groups &amp; Kids
            </div>
          </div>

          <div className="bg-surface rounded-xl border border-line/70 p-6 sm:p-7 transition-all hover:border-gold/60 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-lg bg-surface-mid grid place-items-center mb-4 text-gold">
                <Icon name="parking" className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl text-ink font-semibold mb-2">
                Effortless Parking &amp; Access
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">
                Arriving guests benefit from a dedicated on-site parking lot as well as complimentary
                street parking along the wide marquee frontage on Rashidpur–Orangabad Road.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-line/40 text-xs font-semibold uppercase tracking-wider text-gold">
              Free Lot &amp; Street Parking
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
