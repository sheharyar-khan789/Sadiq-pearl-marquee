import { business, media } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import AmbientVideo from "./AmbientVideo";
import SectionHead from "./Section";
import Icon, { TikTokGlyph, WhatsAppGlyph } from "./Icon";

export default function Location() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about visiting Sadiq Pearl Marquee or getting directions."
  );

  return (
    <section id="contact" aria-labelledby="contact-title" className="bg-surface-low py-20 sm:py-28 lg:py-36">
      <span id="location" className="sr-only" />
      <div className="container-px mx-auto grid max-w-content gap-12 grid-cols-1 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHead
            id="contact-title"
            eyebrow="Visit & Contact"
            title={
              <>
                Find us in <em className="text-gold">Kakrot</em>
              </>
            }
            intro="On Rashidpur–Orangabad Road, Sarai Alamgir, with an on-site parking lot and free street parking."
          />

          <div data-reveal className="mt-10 space-y-8">
            <div>
              <h3 className="text-eyebrow font-semibold uppercase text-gold">Address</h3>
              <address className="mt-3 font-display text-[1.625rem] not-italic leading-snug text-ink">
                {business.addressLine1},
                <br />
                {business.addressLine2}
              </address>
              <a
                href={business.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-5"
              >
                <Icon name="pin" className="h-4 w-4" />
                Get directions
              </a>
            </div>

            <div className="border-t border-line pt-8">
              <h3 className="text-eyebrow font-semibold uppercase text-gold">Phone</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {business.phones.map((p) => (
                  <li key={p.href}>
                    <a
                      href={p.href}
                      className="flex min-h-[48px] items-center gap-2.5 whitespace-nowrap rounded-xl border border-line bg-surface px-4 text-[0.9375rem] font-semibold text-ink transition-colors hover:border-ink/40"
                    >
                      <Icon name="phone" className="h-4 w-4 text-gold" />
                      {p.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-line pt-8">
              <h3 className="text-eyebrow font-semibold uppercase text-gold">WhatsApp inquiries</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
                For dates, guest numbers and menus, message us on{" "}
                <strong className="font-semibold text-ink">{WHATSAPP_DISPLAY_NUMBER}</strong>.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                  <WhatsAppGlyph className="h-[18px] w-[18px] text-gold" />
                  Message on WhatsApp
                </a>
                {business.social.tiktok && (
                  <a
                    href={business.social.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline"
                    aria-label={`TikTok ${business.social.tiktokHandle}`}
                  >
                    <TikTokGlyph className="h-4 w-4" />
                    {business.social.tiktokHandle}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div data-reveal="depth" className="relative lg:sticky lg:top-28">
            <AmbientVideo
              src={media.aerialVideo}
              poster={media.aerialPoster}
              label="Aerial view of Sadiq Pearl Marquee and its road frontage"
              sizes="(min-width: 1024px) 700px, 100vw"
              className="aspect-video rounded-3xl bg-espresso shadow-lift"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-3xl bg-gradient-to-t from-espresso/85 to-transparent p-6 pt-20 text-white sm:p-8">
              <p className="text-eyebrow font-semibold uppercase text-gold-light">From above</p>
              <p className="mt-1.5 font-display text-2xl leading-tight sm:text-3xl">
                The marquee and its road frontage
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
