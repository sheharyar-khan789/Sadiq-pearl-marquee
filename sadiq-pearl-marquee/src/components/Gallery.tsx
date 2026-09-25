"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  galleryCategories,
  galleryItems,
  type GalleryCategory,
  type GalleryItem,
} from "@/data/gallery";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";
import { useDialog } from "./useDialog";

interface GalleryProps {
  isDedicatedPage?: boolean;
}

export default function Gallery({ isDedicatedPage = false }: GalleryProps) {
  const [selectedCategory, setSelectedCategory] = useState<GalleryCategory>("all");
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Filter items based on active category
  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") {
      // On homepage, show the top 12 curated highlights; on dedicated page, show all 26
      return isDedicatedPage ? galleryItems : galleryItems.slice(0, 12);
    }
    return galleryItems.filter((item) => item.category === selectedCategory);
  }, [selectedCategory, isDedicatedPage]);

  // Lightbox handlers
  const isLightboxOpen = activeItemIndex !== null;
  const closeLightbox = useCallback(() => setActiveItemIndex(null), []);
  const closeRef = useDialog(isLightboxOpen, closeLightbox);

  const stepLightbox = useCallback(
    (direction: number) => {
      setActiveItemIndex((current) => {
        if (current === null) return null;
        return (current + direction + filteredItems.length) % filteredItems.length;
      });
    },
    [filteredItems.length]
  );

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (activeItemIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepLightbox(1);
      if (e.key === "ArrowLeft") stepLightbox(-1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItemIndex, stepLightbox]);

  // Touch swipe support for mobile
  const touchStartXRef = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchEndX - touchStartXRef.current;
    if (Math.abs(diff) > 40) {
      if (diff < 0) stepLightbox(1); // Swipe left -> Next
      else stepLightbox(-1); // Swipe right -> Prev
    }
    touchStartXRef.current = null;
  };

  const currentItem: GalleryItem | null =
    activeItemIndex !== null ? filteredItems[activeItemIndex] : null;

  return (
    <section
      id="gallery"
      className={`py-16 md:py-24 scroll-mt-20 border-b border-line/40 ${
        isDedicatedPage ? "bg-surface" : "bg-surface-low"
      }`}
    >
      <div className="max-w-content mx-auto container-px">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 sm:mb-12">
          <SectionHead
            eyebrow={isDedicatedPage ? "Complete Venue Gallery" : "Real Photo Gallery"}
            title="Moments &amp; Spaces Inside Sadiq Pearl"
            intro="Explore genuine photographs of our stage setups, crystal chandelier halls, floral arches, and banquet table arrangements on Rashidpur–Orangabad Road."
          />
          <div className="lg:mb-14 flex items-center gap-3 shrink-0">
            <a
              href={getWhatsAppUrl("Assalam o Alaikum, I saw your venue gallery and would like to ask about stage and hall setups for an upcoming event.")}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire on WhatsApp about decor setups: 0345 5673921"
              className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current" />
              <span>Inquire About Setups</span>
            </a>
            {!isDedicatedPage && (
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 h-11 px-4 rounded border border-line hover:border-gold text-ink font-semibold text-xs sm:text-sm transition-colors"
              >
                <span>Full Archive</span>
                <Icon name="arrow" className="w-3.5 h-3.5 text-gold" />
              </Link>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div
          role="tablist"
          aria-label="Gallery category filters"
          className="flex flex-wrap gap-2 sm:gap-2.5 mb-8 sm:mb-10"
        >
          {galleryCategories.map((cat) => {
            const count =
              cat.key === "all"
                ? galleryItems.length
                : galleryItems.filter((i) => i.category === cat.key).length;

            return (
              <button
                key={cat.key}
                role="tab"
                aria-selected={selectedCategory === cat.key}
                onClick={() => {
                  setSelectedCategory(cat.key);
                  setActiveItemIndex(null);
                }}
                className={`min-h-[44px] px-4 sm:px-5 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                  selectedCategory === cat.key
                    ? "bg-gold text-white shadow-sm ring-2 ring-gold/20"
                    : "bg-surface border border-line text-ink-soft hover:border-gold hover:text-gold"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                    selectedCategory === cat.key
                      ? "bg-white/20 text-white"
                      : "bg-surface-mid text-ink-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Editorial Asymmetric Photo Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {filteredItems.map((item, index) => {
            // Apply editorial spans for natural visual hierarchy
            const isHeroItem = index === 0 && selectedCategory === "all";
            const isWideItem = (index === 4 || index === 9) && selectedCategory === "all";

            return (
              <article
                key={item.id}
                className={`group relative overflow-hidden rounded-2xl bg-surface-high border border-line/70 hover:border-gold/60 transition-all duration-300 shadow-sm hover:shadow-md ${
                  isHeroItem
                    ? "sm:col-span-2 sm:row-span-2 aspect-[4/3] sm:aspect-[1/1] lg:aspect-[4/3]"
                    : isWideItem
                    ? "sm:col-span-2 aspect-[16/10]"
                    : item.aspect === "portrait"
                    ? "aspect-[4/5]"
                    : "aspect-[16/11]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveItemIndex(index)}
                  className="w-full h-full block text-left relative focus-visible:ring-4 focus-visible:ring-gold/60"
                  aria-label={`View full photo: ${item.title}`}
                >
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes={
                      isHeroItem
                        ? "(min-width: 1024px) 50vw, 100vw"
                        : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    }
                    className="object-cover transition-transform duration-700 ease-elegant group-hover:scale-105"
                  />

                  {/* Gradient Overlay for Text Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

                  {/* Expand icon indicator on hover/focus */}
                  <div className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-night/60 backdrop-blur-md text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="expand" className="w-4 h-4 text-gold-light" />
                  </div>

                  {/* Caption & Metadata */}
                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 text-white">
                    <span className="text-[10px] uppercase tracking-widest text-gold-light font-semibold block mb-1">
                      {item.category === "interior"
                        ? "Hall & Aisles"
                        : item.category === "decoration"
                        ? "Stage & Florals"
                        : item.category === "exterior"
                        ? "Exterior Frontage"
                        : "Dining Course"}
                    </span>
                    <h3 className="font-display text-base sm:text-lg font-medium leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-white/80 line-clamp-1 mt-1 font-body">
                      {item.caption}
                    </p>
                  </div>
                </button>
              </article>
            );
          })}
        </div>

        {/* Dedicated Page Bottom WhatsApp CTA or Homepage Full Gallery Trigger */}
        {!isDedicatedPage && galleryItems.length > 12 && (
          <div className="mt-12 text-center">
            <Link
              href="/gallery"
              className="inline-flex items-center gap-2.5 bg-surface border border-gold/70 hover:border-gold text-gold hover:bg-gold hover:text-white font-semibold text-sm h-12 px-7 rounded-xl transition-all shadow-sm"
            >
              <span>Explore All {galleryItems.length} Venue Photos</span>
              <Icon name="arrow" className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* FULLSCREEN LIGHTBOX DIALOG */}
      {isLightboxOpen && currentItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo preview: ${currentItem.title}`}
          className="fixed inset-0 z-[80] bg-night/95 backdrop-blur-md flex flex-col justify-between"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 text-white">
            <div className="leading-tight">
              <span className="text-xs text-gold-light uppercase tracking-wider block">
                Photo {activeItemIndex + 1} of {filteredItems.length}
              </span>
              <h2 className="font-display text-base sm:text-lg font-medium">
                {currentItem.title}
              </h2>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={closeLightbox}
              aria-label="Close photo preview"
              className="w-11 h-11 grid place-items-center rounded-full hover:bg-white/10 text-white transition-colors"
            >
              <Icon name="close" className="w-6 h-6" />
            </button>
          </div>

          {/* Central Image Viewport */}
          <div className="relative flex-1 min-h-0 w-full p-2 sm:p-6 flex items-center justify-center">
            <div className="relative w-full h-full max-h-[82vh]">
              <Image
                key={currentItem.id}
                src={currentItem.image}
                alt={currentItem.title}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            {/* Navigation Arrows */}
            <button
              type="button"
              onClick={() => stepLightbox(-1)}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-black/60 text-white hover:bg-gold transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Icon name="prev" className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => stepLightbox(1)}
              aria-label="Next photo"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-black/60 text-white hover:bg-gold transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Icon name="next" className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Bar: Caption & WhatsApp Inquiry */}
          <div className="p-4 border-t border-white/10 bg-night/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p className="text-xs sm:text-sm text-white/80 max-w-xl">
              {currentItem.caption}
            </p>
            <div className="flex items-center gap-3">
              <a
                href={getWhatsAppUrl(
                  `Assalam o Alaikum, I am inquiring about this setup from your gallery: ${currentItem.title}.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-10 px-5 rounded transition-colors shadow"
              >
                <WhatsAppGlyph className="w-4 h-4 fill-current" />
                <span>Inquire About This Setup</span>
              </a>
              <button
                type="button"
                onClick={closeLightbox}
                className="inline-flex items-center justify-center text-xs text-white/70 hover:text-white px-3 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
