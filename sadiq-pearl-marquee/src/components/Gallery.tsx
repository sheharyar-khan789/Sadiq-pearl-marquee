"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  categoryLabel,
  galleryCategories,
  galleryItems,
  type GalleryCategory,
} from "@/data/gallery";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import { useDialog } from "./useDialog";
import Icon, { WhatsAppGlyph } from "./Icon";

/**
 * Masonry gallery that keeps every photo at its true ratio (no cropping),
 * with category filters (full page) and an accessible lightbox.
 */
export default function Gallery({ variant = "home" }: { variant?: "home" | "page" }) {
  const isPage = variant === "page";
  const [category, setCategory] = useState<GalleryCategory>("all");
  const [active, setActive] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    if (!isPage) return galleryItems.filter((i) => i.featured);
    return category === "all" ? galleryItems : galleryItems.filter((i) => i.category === category);
  }, [isPage, category]);

  const close = useCallback(() => setActive(null), []);
  const closeRef = useDialog(active !== null, close, dialogRef);
  const step = useCallback(
    (d: number) => setActive((c) => (c === null ? null : (c + d + items.length) % items.length)),
    [items.length]
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, step]);

  const touchX = useRef<number | null>(null);
  const current = active !== null ? items[active] : null;

  const grid = (
    <ul className="columns-2 gap-3 sm:columns-3 sm:gap-5 lg:columns-4">
      {items.map((item, i) => (
        <li key={item.id} className="mb-3 break-inside-avoid sm:mb-5">
          <div data-reveal data-reveal-delay={(i % 4) * 70}>
            <button
              type="button"
              onClick={() => setActive(i)}
              aria-haspopup="dialog"
              aria-label={`Open photo: ${item.title}`}
              className="group relative block w-full overflow-hidden rounded-xl bg-surface-high sm:rounded-2xl"
            >
              <Image
                src={item.image}
                alt={`${item.title} — ${item.caption}`}
                width={item.width}
                height={item.height}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="h-auto w-full transition-transform duration-[1200ms] ease-elegant group-hover:scale-[1.04]"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-espresso/80 via-espresso/0 to-transparent p-3 text-left opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100 sm:p-4 [@media(hover:none)]:opacity-100"
              >
                <span className="hidden text-eyebrow font-semibold uppercase text-gold-light sm:block">
                  {categoryLabel[item.category]}
                </span>
                <span className="mt-1 font-display text-base leading-tight text-white sm:text-lg">{item.title}</span>
              </span>
            </button>
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <section
      id="gallery"
      aria-labelledby={isPage ? undefined : "gallery-title"}
      aria-label={isPage ? "Photo gallery" : undefined}
      className={isPage ? "pb-20 sm:pb-28" : "bg-surface py-20 sm:py-28 lg:py-36"}
    >
      <div className="container-px mx-auto max-w-content">
        {!isPage && (
          <div className="mb-12 flex flex-col gap-8 lg:mb-16 lg:flex-row lg:items-end lg:justify-between">
            <SectionHead
              id="gallery-title"
              eyebrow="Gallery"
              title={
                <>
                  Moments &amp; spaces, <em className="text-gold">as they are</em>
                </>
              }
              intro="Real photographs of stage setups, chandelier halls, floral arches and dining at Sadiq Pearl Marquee."
            />
            <div data-reveal data-reveal-delay="120" className="hidden sm:block">
              <Link href="/gallery" className="btn btn-outline">
                View all {galleryItems.length} photos
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {isPage && (
          <div
            role="group"
            aria-label="Filter photos by category"
            className="no-scrollbar -mx-5 mb-8 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {galleryCategories.map((c) => {
              const count =
                c.key === "all" ? galleryItems.length : galleryItems.filter((i) => i.category === c.key).length;
              const selected = category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setCategory(c.key);
                    setActive(null);
                  }}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-espresso bg-espresso text-surface"
                      : "border-line-strong/50 bg-surface text-ink-soft hover:border-ink/50 hover:text-ink"
                  }`}
                >
                  {c.label}
                  <span className={`text-xs ${selected ? "text-gold-light" : "text-ink-muted"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {grid}

        {!isPage && (
          <div className="mt-10 text-center sm:hidden">
            <Link href="/gallery" className="btn btn-outline w-full">
              View all {galleryItems.length} photos
            </Link>
          </div>
        )}
      </div>

      {current && active !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${active + 1} of ${items.length}: ${current.title}`}
          className="fixed inset-0 z-[80] flex flex-col bg-espresso/95 text-white backdrop-blur-md"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-sm tabular-nums text-white/70">
              {active + 1} / {items.length}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close photo"
              className="grid h-11 w-11 place-items-center rounded-full border border-white/20 hover:bg-white/10"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <Image
              key={current.id}
              src={current.image}
              alt={current.title}
              fill
              sizes="100vw"
              className="animate-fade-in object-contain px-2 sm:px-20"
            />
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/70"
            >
              <Icon name="prev" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/70"
            >
              <Icon name="next" className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <p className="text-eyebrow font-semibold uppercase text-gold-light">{categoryLabel[current.category]}</p>
              <h2 className="mt-1 font-display text-2xl leading-tight">{current.title}</h2>
              <p className="mt-1 text-sm text-white/70">{current.caption}</p>
            </div>
            <a
              href={getWhatsAppUrl(
                `Assalam o Alaikum, I am inquiring about this setup from your gallery: ${current.title}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-accent btn-sm shrink-0"
            >
              <WhatsAppGlyph className="h-4 w-4" />
              Ask about this
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
