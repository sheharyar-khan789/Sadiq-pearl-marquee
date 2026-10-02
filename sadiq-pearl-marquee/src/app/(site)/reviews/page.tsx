import type { Metadata } from "next";
import Link from "next/link";
import Icon, { Stars } from "@/components/Icon";
import { business } from "@/lib/config";
import { formatTimestamp } from "@/lib/booking/format";
import { loadPublicReviews } from "@/lib/booking/reviews-server";
import { breadcrumbJsonLd, jsonLdHtml, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Guest Reviews",
  description: `Reviews written by guests who held their event at ${business.name}, published after their event.`,
  path: "/reviews",
});

// Always the current approved reviews (the list changes when the venue approves one).
export const dynamic = "force-dynamic";

const breadcrumb = jsonLdHtml(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Reviews", path: "/reviews" }]));

export default async function ReviewsPage() {
  const result = await loadPublicReviews();
  return (
    <>
      <header className="bg-surface pb-10 pt-32 sm:pb-14 sm:pt-40">
        <div className="container-px mx-auto max-w-content">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="inline-flex min-h-[44px] items-center hover:text-ink">Home</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-ink">Reviews</li>
            </ol>
          </nav>
          <div className="mt-6 max-w-2xl">
            <p className="eyebrow">Guest reviews</p>
            <h1 className="mt-4 font-display text-[2.75rem] font-medium leading-[1.02] text-ink sm:text-6xl">
              From guests who <em className="text-gold">celebrated here</em>
            </h1>
            <p className="mt-5 text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
              Every review here was written by a guest after their event at {business.name} and approved by our team before publishing.
            </p>
          </div>
        </div>
      </header>

      <section aria-label="Reviews" className="bg-surface-low py-14 sm:py-20">
        <div className="container-px mx-auto grid max-w-content gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            {result.ok && result.aggregate.count > 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-6">
                <p className="flex items-end gap-3">
                  <span className="font-display text-6xl font-medium leading-none text-ink">{result.aggregate.average}</span>
                  <Stars value={result.aggregate.average ?? 0} className="h-4 w-4" />
                </p>
                <p className="mt-2 text-sm text-ink-muted">
                  Average of {result.aggregate.count} published review{result.aggregate.count === 1 ? "" : "s"} on this website
                </p>
                <ul className="mt-5 space-y-1.5 text-sm" aria-label="Ratings breakdown">
                  {[...result.aggregate.distribution].reverse().map((d) => (
                    <li key={d.stars} className="flex items-center gap-3">
                      <span className="w-14 shrink-0 text-ink-soft">{d.stars} star{d.stars === 1 ? "" : "s"}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-mid" aria-hidden="true">
                        <span className="block h-full rounded-full bg-gold-container" style={{ width: `${(d.count / result.aggregate.count) * 100}%` }} />
                      </span>
                      <span className="w-6 shrink-0 text-right tabular-nums text-ink">{d.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-6 space-y-3 text-sm leading-relaxed text-ink-soft">
              <p>Held your event with us? Sign in and open your booking to leave a review.</p>
              <Link href="/account/bookings" className="btn btn-outline btn-sm">
                Review your event
              </Link>
              <p className="pt-2">
                <a href={business.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-gold underline-offset-2 hover:underline">
                  Read our reviews on Google
                  <Icon name="external" className="h-4 w-4" />
                </a>
              </p>
            </div>
          </div>

          <div className="lg:col-span-8">
            {!result.ok ? (
              <p role="alert" className="rounded-2xl border border-line bg-surface p-6 text-ink-soft">
                Reviews can&rsquo;t be shown right now. Please try again later.
              </p>
            ) : result.reviews.length === 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-8 text-center">
                <p className="font-display text-2xl text-ink">Reviews from our guests will appear here.</p>
                <p className="mt-2 text-sm text-ink-muted">Guests can review their event after it has taken place.</p>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {result.reviews.map((r) => (
                  <li key={r.reviewId}>
                    <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6">
                      <Stars value={r.rating} className="h-3.5 w-3.5" />
                      <blockquote className="mt-4 flex-1 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-ink">{r.text}</blockquote>
                      <figcaption className="mt-5 border-t border-line pt-3 text-sm">
                        <span className="block font-semibold text-ink">{r.displayName}</span>
                        <span className="text-xs text-ink-muted">
                          {r.eventTypeLabel} · published <time dateTime={r.publishedAt}>{formatTimestamp(r.publishedAt).split(",")[0]}</time>
                        </span>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumb }} />
    </>
  );
}
