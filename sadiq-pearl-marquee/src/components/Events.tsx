import Image from "next/image";
import { eventCategories } from "@/data/events";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import BookNowButton from "./BookNowButton";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

export default function Events() {
  const events = eventCategories.filter((e) => e.enabled);

  return (
    <section id="events" aria-labelledby="events-title" className="bg-surface py-20 sm:py-28 lg:py-36">
      <div className="container-px mx-auto max-w-content">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead
            id="events-title"
            eyebrow="Occasions"
            title={
              <>
                For every family <em className="text-gold">milestone</em>
              </>
            }
            intro="From mehndi nights and barat receptions to walima lunches and intimate family gatherings."
          />
          <div data-reveal data-reveal-delay="120" className="shrink-0">
            <BookNowButton className="btn btn-primary">
              Book Your Event
              <Icon name="arrow" className="h-4 w-4" />
            </BookNowButton>
          </div>
        </div>

        <ul
          aria-label="Event types"
          className="no-scrollbar -mx-5 mt-12 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-12 lg:overflow-visible lg:px-0"
        >
          {events.map((e, i) => (
            <li key={e.slug} className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-auto">
              <article data-reveal data-reveal-delay={(i % 3) * 90} className="group flex h-full flex-col">
                <div
                  data-tilt
                  className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-high shadow-soft lg:aspect-square"
                >
                  <Image
                    src={e.image}
                    alt={e.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 400px, (min-width: 640px) 46vw, 80vw"
                    className="object-cover transition-transform duration-[1400ms] ease-elegant group-hover:scale-[1.05]"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-espresso/70 via-transparent to-transparent" />
                  {e.urduLabel && (
                    <span lang="ur" dir="rtl" className="absolute bottom-4 right-5 text-xl text-gold-pale drop-shadow">
                      {e.urduLabel}
                    </span>
                  )}
                  <span className="absolute left-5 top-5 font-display text-sm italic text-white/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex flex-1 flex-col pt-5">
                  <h3 className="font-display text-[1.75rem] leading-tight text-ink">{e.title}</h3>
                  <p className="mt-2 flex-1 text-[0.9375rem] leading-relaxed text-ink-soft">{e.description}</p>
                  <a
                    href={getWhatsAppUrl(
                      `Assalam o Alaikum, I am interested in booking Sadiq Pearl Marquee for a ${e.title} event. Please share availability.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-[44px] items-center gap-2 self-start text-sm font-semibold text-gold transition-colors hover:text-ink"
                  >
                    <WhatsAppGlyph className="h-4 w-4" />
                    <span className="link-underline">Inquire about {e.title.toLowerCase()}</span>
                  </a>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
