import Image from "next/image";
import { highlights } from "@/data/highlights";
import { venueFeatures } from "@/lib/config";
import SectionHead from "./Section";
import Icon, { type IconName } from "./Icon";

const icons: IconName[] = ["dining", "groups", "parking", "light"];

export default function Amenities() {
  return (
    <section id="amenities" aria-labelledby="amenities-title" className="overflow-hidden bg-surface-low py-20 sm:py-28 lg:py-36">
      <div className="container-px mx-auto grid max-w-content items-center gap-14 grid-cols-1 lg:grid-cols-12 lg:gap-20">
        <div className="relative order-2 lg:order-1 lg:col-span-5">
          <div data-parallax="0.06" className="relative mx-auto max-w-[420px]">
            <div
              data-reveal="depth"
              className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-3xl bg-surface-high shadow-lift sm:aspect-[3/4]"
            >
              <Image
                src="/images/gallery/chandelier-hall.jpg"
                alt="Hall with overhead chandeliers and illuminated stage"
                fill
                sizes="(min-width: 1024px) 420px, 90vw"
                className="object-cover"
              />
            </div>
            <div aria-hidden="true" className="absolute -inset-3 -z-10 rounded-t-[999px] rounded-b-[2rem] border border-gold-container/30" />
          </div>
        </div>

        <div className="order-1 lg:order-2 lg:col-span-7">
          <SectionHead
            id="amenities-title"
            eyebrow="Amenities"
            title={
              <>
                Comfort, service &amp; <em className="text-gold">easy access</em>
              </>
            }
            intro="The essentials families ask about first, as listed on our Google Business Profile."
          />

          <ol className="mt-10 divide-y divide-line border-y border-line">
            {highlights.map((h, i) => (
              <li
                key={h.number}
                data-reveal
                data-reveal-delay={i * 80}
                className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 py-6 sm:grid-cols-[3rem_auto_1fr] sm:items-baseline sm:gap-x-6"
              >
                <span className="hidden font-display text-lg italic text-gold sm:block">{h.number}</span>
                <span className="row-span-2 mt-0.5 grid h-11 w-11 place-items-center rounded-full border border-line-strong/50 text-gold sm:row-span-1 sm:mt-0">
                  <Icon name={icons[i % icons.length]} className="h-5 w-5" />
                </span>
                <div className="sm:col-start-3">
                  <h3 className="font-display text-2xl leading-tight text-ink">{h.title}</h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{h.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <ul aria-label="Venue features" data-reveal className="mt-8 flex flex-wrap gap-2">
            {venueFeatures.map((f) => (
              <li key={f} className="rounded-full border border-line-strong/40 bg-surface px-4 py-2 text-[0.8125rem] font-medium text-ink-soft">
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
