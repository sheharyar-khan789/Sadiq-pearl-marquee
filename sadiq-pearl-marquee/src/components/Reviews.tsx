import Link from "next/link";
import { business } from "@/lib/config";
import { googleHighlights, reviews } from "@/data/reviews";
import SectionHead from "./Section";
import Icon, { Stars } from "./Icon";

export default function Reviews() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-surface py-20 sm:py-28 lg:py-36">
      <div className="container-px mx-auto grid max-w-content gap-12 grid-cols-1 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <SectionHead
            id="reviews-title"
            eyebrow="Guest Reviews"
            title={
              <>
                What guests say <em className="text-gold">on Google</em>
              </>
            }
          />
          <div data-reveal data-reveal-delay="100" className="mt-8 flex items-end gap-4">
            <span className="font-display text-7xl font-medium leading-none text-ink">{business.rating}</span>
            <div className="pb-1.5">
              <Stars value={business.rating} className="h-4 w-4" />
              <p className="mt-1.5 text-sm text-ink-muted">
                Average of {business.reviewCount} Google reviews
              </p>
            </div>
          </div>
          <a
            data-reveal
            data-reveal-delay="160"
            href={business.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline mt-8"
          >
            Read all reviews on Google
            <Icon name="external" className="h-4 w-4" />
          </a>
          <Link href="/reviews" className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-gold underline-offset-2 hover:underline">
            Reviews from guests on our website
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>

        <div className="lg:col-span-8">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {reviews.map((r, i) => (
              <li key={r.author} data-reveal data-reveal-delay={i * 90}>
                <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface-low p-6">
                  <Stars value={r.rating} className="h-3.5 w-3.5" />
                  <blockquote className="mt-5 flex-1 font-display text-[1.625rem] italic leading-snug text-ink">
                    &ldquo;{r.text}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 border-t border-line pt-4 text-sm">
                    <span className="block font-semibold text-ink">{r.author}</span>
                    <span className="text-xs text-ink-muted">
                      Google review{r.context ? ` · ${r.context}` : ""}
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>

          <div data-reveal className="mt-4 rounded-2xl border border-line p-6">
            <p className="text-eyebrow font-semibold uppercase text-gold">Google&rsquo;s review summary</p>
            <ul className="mt-3 space-y-2 text-[0.9375rem] leading-relaxed text-ink-soft">
              {googleHighlights.map((h) => (
                <li key={h} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-gold-container" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
