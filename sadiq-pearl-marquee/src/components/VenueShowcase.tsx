import Image from "next/image";
import SectionHead from "./Section";
import Icon from "./Icon";

// Captions reuse the verified gallery descriptions. No capacity or size claims:
// those are unconfirmed and intentionally not published.
const spaces = [
  {
    title: "The Stage",
    label: "Ceremony",
    caption: "Carved gold sofas, layered floral canopy and a patterned stage floor.",
    image: "/images/gallery/royal-stage.jpg",
    alt: "Wedding stage with gold sofas, a white floral canopy and a patterned floor",
  },
  {
    title: "Grand Foyer",
    label: "Arrival",
    caption: "Crystal chandeliers and a marble floor at the doorway into the hall.",
    image: "/images/exterior/exterior-colonnade.jpg",
    alt: "Grand foyer with crystal chandeliers and a marble floor at the doorway into the hall",
  },
  {
    title: "VIP Lounge",
    label: "Family",
    caption: "Comfortable sofa seating for family elders and close guests.",
    image: "/images/interior/interior-vip-lounge.jpg",
    alt: "VIP lounge with sofa seating",
  },
  {
    title: "Entrance Portico",
    label: "Exterior",
    caption: "A columned portico beneath the Sadiq Pearl signage.",
    image: "/images/exterior/exterior-daytime-facade.jpg",
    alt: "Columned entrance portico of Sadiq Pearl Marquee in daylight",
  },
];

export default function VenueShowcase() {
  return (
    <section id="venue" aria-labelledby="venue-title" className="bg-surface-low py-20 sm:py-28 lg:py-36">
      <div className="container-px mx-auto max-w-content">
        <div className="grid items-end gap-10 grid-cols-1 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5 lg:pb-6">
            <SectionHead
              id="venue-title"
              eyebrow="The Venue"
              title={
                <>
                  Spaces made for <em className="text-gold">gathering</em>
                </>
              }
              intro="A banquet hall with table service, a dedicated stage, a chandelier-lit lobby and a columned entrance — each space photographed as it is."
            />
          </div>

          <figure data-reveal="depth" className="group relative lg:col-span-7">
            <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-surface-high shadow-lift">
              <Image
                src="/images/interior/interior-banquet-full.jpg"
                alt="Banquet hall with guest tables arranged for table-service dining"
                fill
                sizes="(min-width: 1320px) 740px, (min-width: 1024px) 56vw, 100vw"
                className="object-cover transition-transform duration-[1400ms] ease-elegant group-hover:scale-[1.04]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-espresso/90 via-espresso/35 to-transparent" />
            </div>
            <figcaption className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
              <p className="text-eyebrow font-semibold uppercase text-gold-light">Main Banquet Hall</p>
              <p className="mt-2 max-w-md font-display text-2xl leading-tight sm:text-3xl">
                Expansive seating arranged for table-service dining
              </p>
            </figcaption>
          </figure>
        </div>

        <ul
          aria-label="Venue spaces"
          className="no-scrollbar -mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:mt-16 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible lg:px-0"
        >
          {spaces.map((s, i) => (
            <li key={s.title} className="w-[78%] shrink-0 snap-start sm:w-[44%] lg:w-auto">
              <div data-reveal data-reveal-delay={i * 90}>
                <figure
                  data-tilt
                  className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface-high shadow-soft transition-shadow duration-500 hover:shadow-lift"
                >
                  <Image
                    src={s.image}
                    alt={s.alt}
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 44vw, 78vw"
                    className="object-cover transition-transform duration-[1400ms] ease-elegant group-hover:scale-[1.05]"
                  />
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-espresso/85 via-espresso/15 to-transparent" />
                  <figcaption className="absolute inset-x-0 bottom-0 p-5 text-white [transform:translateZ(30px)]">
                    <p className="text-eyebrow font-semibold uppercase text-gold-light">{s.label}</p>
                    <p className="mt-1.5 font-display text-2xl leading-tight">{s.title}</p>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed text-white/75">{s.caption}</p>
                  </figcaption>
                </figure>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted lg:hidden" aria-hidden="true">
          <Icon name="arrow" className="h-3.5 w-3.5" />
          Swipe to explore
        </p>
      </div>
    </section>
  );
}
