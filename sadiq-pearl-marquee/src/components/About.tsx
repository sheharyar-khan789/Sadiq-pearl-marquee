import Image from "next/image";
import { business } from "@/lib/config";
import SectionHead from "./Section";
import Icon, { Stars } from "./Icon";

// Every fact here is verified (Google Business Profile, printed menu card, config.ts).
const trust = [
  { value: `${business.rating}`, label: `Google rating · ${business.reviewCount} reviews`, stars: true },
  { value: "Lunch & Dinner", label: "Table-service dining" },
  { value: "Free Parking", label: "On-site lot & street" },
  { value: "In-house Catering", label: "Wedding & mehndi menus" },
];

export default function About() {
  return (
    <section id="about" aria-labelledby="about-title" className="relative overflow-hidden bg-surface">
      {/* Trust strip */}
      <div className="border-b border-line/80 bg-surface-low">
        <ul className="container-px mx-auto grid max-w-content grid-cols-2 lg:grid-cols-4">
          {trust.map((t, i) => (
            <li
              key={t.value}
              data-reveal
              data-reveal-delay={i * 80}
              className={`flex flex-col justify-center gap-1 py-6 sm:py-8 ${
                i % 2 === 1 ? "border-l border-line/80 pl-5 sm:pl-8" : "pr-4"
              } ${i >= 2 ? "border-t border-line/80 lg:border-t-0" : ""} ${
                i === 2 ? "lg:border-l lg:pl-8" : ""
              }`}
            >
              <span className="flex items-center gap-2 font-display text-[1.625rem] font-medium leading-none text-ink sm:text-3xl">
                {t.value}
                {t.stars && <Stars value={business.rating} className="h-3.5 w-3.5" />}
              </span>
              <span className="text-[0.8125rem] text-ink-muted">{t.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="container-px mx-auto grid max-w-content items-center gap-14 py-20 sm:py-28 grid-cols-1 lg:grid-cols-12 lg:gap-16 lg:py-36">
        <div className="lg:col-span-5">
          <SectionHead
            id="about-title"
            eyebrow="About Sadiq Pearl"
            title={
              <>
                A grand setting for your family&rsquo;s <em className="text-gold">celebrations</em>
              </>
            }
            intro={`Prominently located on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir, ${business.name} brings together grand architecture, crystal chandeliers and warm Pakistani hospitality.`}
          />
          <p data-reveal data-reveal-delay="100" className="mt-5 text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
            From the illuminated entrance colonnade to the banquet hall and attentive table service, the venue is
            arranged to make weddings, mehndi, barat, walima and family gatherings feel effortless and dignified.
          </p>
          <div data-reveal data-reveal-delay="180" className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
            <a href="#venue" className="btn btn-primary">
              Explore the venue
              <Icon name="arrow" className="h-4 w-4" />
            </a>
            <a
              href={business.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline inline-flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <Icon name="pin" className="h-4 w-4 text-gold" />
              Kakrot, Sarai Alamgir
            </a>
          </div>
        </div>

        {/* Layered depth composition */}
        <div className="relative lg:col-span-7">
          <div className="relative mx-auto max-w-[560px] pb-16 pl-10 sm:pb-20 sm:pl-24 lg:ml-auto lg:mr-0">
            <div data-parallax="0.05" className="relative">
              <div
                data-reveal="depth"
                className="relative aspect-[3/4] overflow-hidden rounded-t-[999px] rounded-b-2xl bg-surface-high shadow-lift"
              >
                <Image
                  src="/images/gallery/crystal-hall.jpg"
                  alt="Crystal chandeliers and illuminated hall décor inside Sadiq Pearl Marquee"
                  fill
                  sizes="(min-width: 1024px) 460px, (min-width: 640px) 440px, 85vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div
              data-parallax="0.13"
              className="absolute bottom-0 left-0 w-[46%] max-w-[240px]"
            >
              <div
                data-reveal="depth"
                data-reveal-delay="150"
                className="relative aspect-[3/4] overflow-hidden rounded-2xl border-[6px] border-surface bg-surface-high shadow-lift"
              >
                <Image
                  src="/images/gallery/entrance-lobby.jpg"
                  alt="Floral welcome arrangements in the entrance lobby"
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              </div>
            </div>
            <div data-parallax="0.09" className="absolute right-0 top-10 hidden sm:block">
              <div
                data-reveal
                data-reveal-delay="260"
                className="rounded-2xl border border-line/80 bg-surface/90 px-5 py-4 shadow-soft backdrop-blur"
              >
                <p className="text-eyebrow font-semibold uppercase text-gold">Interior</p>
                <p className="mt-1 font-display text-lg leading-tight text-ink">Crystal chandelier hall</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
