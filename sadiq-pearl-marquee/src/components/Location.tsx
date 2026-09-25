import Image from "next/image";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { TikTokGlyph, WhatsAppGlyph } from "./Icon";

export default function Location() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about visiting Sadiq Pearl Marquee or getting directions."
  );

  return (
    <section id="contact" className="py-16 md:py-24 scroll-mt-20 border-b border-line/40 bg-surface">
      <span id="location" className="sr-only" />

      <div className="max-w-content mx-auto container-px">
        {/* Section Header */}
        <div className="mb-12 sm:mb-16">
          <SectionHead
            eyebrow="Location &amp; Direct Contact"
            title="Visit Sadiq Pearl Marquee"
            intro="Located prominently on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir. Easily accessible with generous on-site and street parking for all arriving guests."
          />
        </div>

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Left Column: Verified Contact Details */}
          <div className="lg:col-span-6 space-y-6">
            {/* Card 1: Physical Address & Directions */}
            <div className="p-6 sm:p-7 rounded-2xl bg-surface-low border border-line/70 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold grid place-items-center shrink-0 mt-0.5">
                  <Icon name="pin" className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-lg sm:text-xl text-ink font-semibold">
                    Venue Address
                  </h3>
                  <address className="not-italic text-sm sm:text-base text-ink-soft leading-relaxed mt-1">
                    <strong className="text-ink font-semibold block">{business.name}</strong>
                    {business.addressLine1},<br />
                    {business.addressLine2}
                  </address>
                  <div className="mt-4 pt-4 border-t border-line/50 flex flex-wrap items-center gap-3">
                    <a
                      href={business.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <Icon name="pin" className="w-4 h-4" />
                      <span>Get Directions</span>
                    </a>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                      <Icon name="parking" className="w-3.5 h-3.5 text-gold" />
                      <span>Free on-site parking</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Direct Phone Numbers */}
            <div className="p-6 sm:p-7 rounded-2xl bg-surface-low border border-line/70 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold grid place-items-center shrink-0 mt-0.5">
                  <Icon name="phone" className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <h3 className="font-display text-lg sm:text-xl text-ink font-semibold">
                    Telephone Numbers
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5 mb-3">
                    Call our management directly for reservations and event queries:
                  </p>
                  <ul className="grid sm:grid-cols-3 gap-2.5">
                    {business.phones.map((phone, idx) => (
                      <li key={phone.href}>
                        <a
                          href={phone.href}
                          className="flex flex-col p-3 rounded-xl bg-surface border border-line/70 hover:border-gold text-ink hover:text-gold transition-colors text-center"
                        >
                          <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                            {idx === 0 ? "Line 1" : idx === 1 ? "Line 2" : "Line 3"}
                          </span>
                          <span className="font-semibold text-xs sm:text-sm mt-0.5 whitespace-nowrap">
                            {phone.display}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Card 3: WhatsApp Inquiry (Strictly 03455673921) */}
            <div className="p-6 sm:p-7 rounded-2xl bg-surface-low border border-line/70 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="w-11 h-11 rounded-xl bg-gold/10 text-gold grid place-items-center shrink-0 mt-0.5">
                  <WhatsAppGlyph className="w-5 h-5 fill-current" />
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg sm:text-xl text-ink font-semibold">
                      WhatsApp Inquiries
                    </h3>
                    <span className="text-[10px] uppercase tracking-wider text-gold font-semibold bg-gold/10 px-2 py-0.5 rounded">
                      Inquiry Line
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-ink-soft leading-relaxed mt-1 mb-4">
                    Send inquiries regarding date availability, guest counts, and catering options to our dedicated WhatsApp number:
                    <strong className="text-ink font-semibold ml-1">0345 5673921</strong>.
                  </p>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Inquire on WhatsApp: 0345 5673921"
                    className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <WhatsAppGlyph className="w-4 h-4 fill-current" />
                    <span>Inquire on WhatsApp (0345 5673921)</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Card 4: Verified TikTok Social Profile */}
            {business.social.tiktok && (
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-low border border-line/70 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-night text-white grid place-items-center shrink-0">
                    <TikTokGlyph className="w-5 h-5 fill-current" />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-ink">
                      Official TikTok
                    </h4>
                    <p className="text-xs text-ink-muted">
                      {business.social.tiktokHandle}
                    </p>
                  </div>
                </div>
                <a
                  href={business.social.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-container font-semibold transition-colors"
                >
                  <span>Follow profile</span>
                  <Icon name="external" className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* Right Column: Real Venue Photography & Map Destination */}
          <div className="lg:col-span-6 space-y-6">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-line/70 bg-surface-high">
              <Image
                src={media.daytimeFacade}
                alt="Sadiq Pearl Marquee exterior frontage in daylight on Rashidpur–Orangabad Road"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <span className="text-[10px] uppercase tracking-widest text-gold-light font-semibold block mb-1">
                  Marquee Exterior &amp; Frontage
                </span>
                <p className="font-display text-lg sm:text-xl font-medium leading-tight">
                  Rashidpur–Orangabad Road, Kakrot, Sarai Alamgir
                </p>
                <p className="text-xs text-white/80 mt-1">
                  Illuminated facade with generous on-site and street parking
                </p>
              </div>
            </div>

            {/* Verified Google Maps Box */}
            <div className="p-6 rounded-2xl bg-surface-low border border-line/70 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-1">
                  Navigation &amp; Travel
                </p>
                <h4 className="font-display text-base sm:text-lg text-ink font-semibold">
                  Google Maps Location
                </h4>
                <p className="text-xs text-ink-soft mt-0.5">
                  Open coordinates and turn-by-turn navigation directly on your device.
                </p>
              </div>
              <a
                href={business.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-surface hover:bg-gold hover:text-white border border-gold text-gold font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all shadow-sm shrink-0"
              >
                <Icon name="pin" className="w-4 h-4" />
                <span>Open in Google Maps</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
