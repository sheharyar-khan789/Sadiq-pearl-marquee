import { business } from "@/lib/config";
import { googleHighlights, reviews } from "@/data/reviews";
import SectionHead from "./Section";
import Icon, { Stars } from "./Icon";

export default function Reviews() {
  return (
    <section
      id="reviews"
      className="bg-surface-mid/60 py-16 md:py-24 scroll-mt-20 border-b border-line/40"
    >
      <div className="max-w-content mx-auto container-px">
        {/* Header & Rating Showcase */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 sm:mb-16">
          <SectionHead
            eyebrow="Google Verified Reviews"
            title="Guest Impressions &amp; Experiences"
            intro="Authentic feedback from families who celebrated wedding ceremonies, receptions, and occasions at Sadiq Pearl Marquee on Rashidpur–Orangabad Road."
          />

          {/* Rating Summary Card */}
          <div className="lg:mb-14 p-5 sm:p-6 rounded-2xl bg-surface border border-line/70 shadow-sm shrink-0 flex items-center gap-5">
            <div className="flex flex-col items-center justify-center pr-5 border-r border-line/60">
              <span className="font-display text-4xl sm:text-5xl text-ink font-semibold leading-none">
                {business.rating}
              </span>
              <span className="text-xs text-ink-muted mt-1">out of 5.0</span>
            </div>
            <div>
              <Stars value={business.rating} className="w-4 h-4 text-gold" />
              <p className="text-xs sm:text-sm font-semibold text-ink mt-1.5">
                {business.reviewCount} Verified Google Reviews
              </p>
              <a
                href={business.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View Sadiq Pearl Marquee Google reviews on Google Maps"
                className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold-container font-semibold mt-1 transition-colors group"
              >
                <span>Read reviews on Google Maps</span>
                <Icon name="external" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>
          </div>
        </div>

        {/* 3 Real Google Reviews Cards */}
        <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-12">
          {reviews.map((review) => (
            <blockquote
              key={review.author}
              className="bg-surface rounded-2xl border border-line/70 p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:border-gold/60 transition-all duration-300"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <Stars value={review.rating} className="w-3.5 h-3.5 text-gold" />
                  <span className="text-[11px] text-ink-muted bg-surface-mid px-2.5 py-0.5 rounded-full font-medium">
                    Google Review
                  </span>
                </div>
                <p className="font-display text-lg sm:text-xl text-ink font-medium leading-relaxed italic">
                  &ldquo;{review.text}&rdquo;
                </p>
              </div>

              <footer className="mt-6 pt-4 border-t border-line/50 flex items-center justify-between text-xs text-ink-soft">
                <div>
                  <cite className="font-semibold text-ink not-italic block">
                    {review.author}
                  </cite>
                  {review.context && (
                    <span className="text-ink-muted text-[11px] mt-0.5 block">
                      Occasion: {review.context}
                    </span>
                  )}
                </div>
                <span className="w-6 h-6 rounded-full bg-gold/10 text-gold grid place-items-center text-xs font-semibold">
                  ✓
                </span>
              </footer>
            </blockquote>
          ))}
        </div>

        {/* Google Highlights & Confirmed Venue Features */}
        <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-line/70 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="text-xs uppercase tracking-widest text-gold font-semibold block">
              Google Profile Insights
            </span>
            <ul className="space-y-1.5 text-xs sm:text-sm text-ink-soft">
              {googleHighlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-gold mt-1">•</span>
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="shrink-0 w-full lg:w-auto">
            <a
              href={business.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <span>Explore Google Business Listing</span>
              <Icon name="external" className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
