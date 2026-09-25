"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  menuPdf,
  menuSheets,
  mehndiMenus,
  sweetsAndSides,
  weddingMenus,
  type MenuSet,
} from "@/data/menu";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import { useBooking } from "./BookingContext";
import { useDialog } from "./useDialog";
import Icon, { WhatsAppGlyph } from "./Icon";

type MainTab = "sheets" | "wedding" | "mehndi" | "sweets";

export default function Menus() {
  const [activeTab, setActiveTab] = useState<MainTab>("sheets");
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { openTerms } = useBooking();

  const isLightboxOpen = lightboxIndex !== null;
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const closeRef = useDialog(isLightboxOpen, closeLightbox);

  const stepLightbox = useCallback(
    (direction: number) => {
      setLightboxIndex((curr) => {
        if (curr === null) return null;
        return (curr + direction + menuSheets.length) % menuSheets.length;
      });
    },
    []
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") stepLightbox(1);
      if (e.key === "ArrowLeft") stepLightbox(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, stepLightbox]);

  const generalMenuWaUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about the menu options and per-head rates at Sadiq Pearl Marquee."
  );

  const activeSheet = menuSheets[selectedSheetIndex];
  const currentLightboxSheet =
    lightboxIndex !== null ? menuSheets[lightboxIndex] : null;

  return (
    <section id="menus" className="py-16 md:py-24 scroll-mt-20 border-b border-line/40 bg-surface">
      <div className="max-w-content mx-auto container-px">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10 sm:mb-12">
          <SectionHead
            eyebrow="Catering &amp; Menus"
            title="Authentic Pakistani Catering &amp; Menus"
            intro="Carefully prepared wedding and mehndi menus directly from our official printed menu card. Each menu is paired with fresh roghni naan, fresh salad, raita, and drinks."
          />
          <div className="lg:mb-14 flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={generalMenuWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire about menu per-head rates on WhatsApp: 0345 5673921"
              className="inline-flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-12 px-6 rounded transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current" />
              <span>Ask About Menu Rates</span>
            </a>
            <a
              href={menuPdf}
              download
              aria-label="Download Sadiq Pearl Marquee menu card PDF"
              className="inline-flex items-center gap-2 h-12 px-5 rounded border border-line hover:border-gold text-ink font-semibold text-sm transition-colors"
            >
              <Icon name="download" className="w-4 h-4 text-gold" />
              <span>Download PDF</span>
            </a>
          </div>
        </div>

        {/* Category Navigation Tabs */}
        <div
          role="tablist"
          aria-label="Menu format navigation"
          className="flex flex-wrap gap-2.5 mb-10 border-b border-line/50 pb-4"
        >
          <button
            role="tab"
            aria-selected={activeTab === "sheets"}
            onClick={() => setActiveTab("sheets")}
            className={`min-h-[44px] px-5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "sheets"
                ? "bg-gold text-white shadow-sm ring-2 ring-gold/20"
                : "bg-surface-low border border-line text-ink-soft hover:border-gold hover:text-gold"
            }`}
          >
            Original Printed Menu Cards (3)
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "wedding"}
            onClick={() => setActiveTab("wedding")}
            className={`min-h-[44px] px-5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "wedding"
                ? "bg-gold text-white shadow-sm ring-2 ring-gold/20"
                : "bg-surface-low border border-line text-ink-soft hover:border-gold hover:text-gold"
            }`}
          >
            Wedding Menus (1 – 7)
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "mehndi"}
            onClick={() => setActiveTab("mehndi")}
            className={`min-h-[44px] px-5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "mehndi"
                ? "bg-gold text-white shadow-sm ring-2 ring-gold/20"
                : "bg-surface-low border border-line text-ink-soft hover:border-gold hover:text-gold"
            }`}
          >
            Mehndi Menus (1 – 2)
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "sweets"}
            onClick={() => setActiveTab("sweets")}
            className={`min-h-[44px] px-5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "sweets"
                ? "bg-gold text-white shadow-sm ring-2 ring-gold/20"
                : "bg-surface-low border border-line text-ink-soft hover:border-gold hover:text-gold"
            }`}
          >
            Desserts &amp; Drinks
          </button>
        </div>

        {/* TAB 1: ORIGINAL PRINTED MENU CARDS (GALLERY / STACKED VIEW) */}
        {activeTab === "sheets" && (
          <div className="space-y-10">
            {/* Desktop & Tablet Curated Showcase */}
            <div className="hidden md:grid lg:grid-cols-12 gap-8 items-start bg-surface-low rounded-2xl p-6 sm:p-8 border border-line/70 shadow-sm">
              {/* Left Selector & Info */}
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <span className="text-xs uppercase tracking-widest text-gold font-semibold block mb-2">
                    Official Document
                  </span>
                  <h3 className="font-display text-2xl sm:text-3xl text-ink font-semibold">
                    Original Printed Menu
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                    Review the exact printed cards provided by Sadiq Pearl Marquee,
                    including Urdu dish titles, course arrangements, and verified banquet options.
                  </p>
                </div>

                {/* Sheet Selection Pills */}
                <div className="space-y-3" role="tablist" aria-label="Menu Card Pages">
                  {menuSheets.map((sheet, index) => (
                    <button
                      key={sheet.src}
                      role="tab"
                      aria-selected={selectedSheetIndex === index}
                      onClick={() => setSelectedSheetIndex(index)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                        selectedSheetIndex === index
                          ? "bg-surface border-gold shadow-sm ring-1 ring-gold/30"
                          : "bg-surface/50 border-line hover:border-gold/50 text-ink-soft"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gold/10 text-gold text-xs font-semibold grid place-items-center">
                          0{index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-ink">
                            Sheet {index + 1}
                          </p>
                          <p className="text-xs text-ink-muted">{sheet.title}</p>
                        </div>
                      </div>
                      <Icon
                        name="arrow"
                        className={`w-4 h-4 transition-transform ${
                          selectedSheetIndex === index
                            ? "text-gold translate-x-1"
                            : "text-ink-muted"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(selectedSheetIndex)}
                    className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-sm h-11 px-5 rounded transition-all shadow-sm"
                  >
                    <Icon name="expand" className="w-4 h-4" />
                    <span>View Sheet Fullscreen</span>
                  </button>
                  <button
                    type="button"
                    onClick={openTerms}
                    className="inline-flex items-center justify-center gap-2 border border-gold/70 text-gold hover:bg-gold/10 font-semibold text-sm h-11 px-5 rounded transition-colors"
                  >
                    <Icon name="doc" className="w-4 h-4" />
                    <span>Read Booking Terms</span>
                  </button>
                </div>
              </div>

              {/* Right: Featured Sheet Display with Zoom Trigger */}
              <div className="lg:col-span-7">
                <div
                  onClick={() => setLightboxIndex(selectedSheetIndex)}
                  className="group relative cursor-pointer aspect-[9/14] sm:aspect-[9/13] max-w-lg mx-auto rounded-xl overflow-hidden shadow-lg border border-line/80 bg-night/5"
                  title="Click to expand fullscreen"
                >
                  <Image
                    src={activeSheet.src}
                    alt={`Sadiq Pearl Marquee printed menu sheet: ${activeSheet.title}`}
                    fill
                    sizes="(min-width: 1024px) 50vw, 85vw"
                    className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-night/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="inline-flex items-center gap-2 bg-night/80 backdrop-blur-md text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                      <Icon name="expand" className="w-4 h-4" />
                      <span>Click to view full resolution</span>
                    </span>
                  </div>
                </div>
                <p className="text-center text-xs text-ink-muted mt-3">
                  Showing Sheet {selectedSheetIndex + 1} of {menuSheets.length}: {activeSheet.title}
                </p>
              </div>
            </div>

            {/* Mobile Stacked Gallery Presentation (No Overflow, Clean Touch Targets) */}
            <div className="md:hidden space-y-6">
              {menuSheets.map((sheet, index) => {
                const sheetWaUrl = getWhatsAppUrl(
                  `Assalam o Alaikum, I am looking at Menu Card Sheet ${index + 1} (${sheet.title}) and would like to ask about per-head rates.`
                );

                return (
                  <div
                    key={sheet.src}
                    className="bg-surface-low rounded-2xl p-5 border border-line/70 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-block text-[11px] uppercase tracking-wider font-semibold text-gold bg-gold/10 px-2.5 py-1 rounded">
                        Sheet 0{index + 1}
                      </span>
                      <span className="text-xs text-ink-muted">
                        Official Menu Card
                      </span>
                    </div>

                    <h4 className="font-display text-lg text-ink font-semibold">
                      {sheet.title}
                    </h4>

                    {/* Image Container with Expand Action */}
                    <div
                      onClick={() => setLightboxIndex(index)}
                      className="relative aspect-[9/13] w-full rounded-xl overflow-hidden shadow-sm border border-line/80 bg-night/5 cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setLightboxIndex(index)}
                      aria-label={`View fullscreen: ${sheet.title}`}
                    >
                      <Image
                        src={sheet.src}
                        alt={`Sadiq Pearl Marquee menu card sheet: ${sheet.title}`}
                        fill
                        sizes="90vw"
                        className="object-contain"
                      />
                      <div className="absolute bottom-3 right-3 bg-night/80 backdrop-blur-md text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
                        <Icon name="expand" className="w-3.5 h-3.5 text-gold-light" />
                        <span>Tap to enlarge</span>
                      </div>
                    </div>

                    {/* Actions for this sheet */}
                    <div className="pt-2 flex flex-col gap-2.5">
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(index)}
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-surface border border-gold/70 text-gold font-semibold text-xs rounded-lg hover:bg-gold/10 transition-colors"
                      >
                        <Icon name="expand" className="w-4 h-4" />
                        <span>View Fullscreen Lightbox</span>
                      </button>
                      <a
                        href={sheetWaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs rounded-lg transition-colors"
                      >
                        <WhatsAppGlyph className="w-4 h-4 fill-current" />
                        <span>Inquire About Sheet 0{index + 1}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: TRANSCRIBED WEDDING MENUS (1 – 7) */}
        {activeTab === "wedding" && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {weddingMenus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} sheetNumber={menu.sheet} />
            ))}
          </div>
        )}

        {/* TAB 3: TRANSCRIBED MEHNDI MENUS (1 – 2) */}
        {activeTab === "mehndi" && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
            {mehndiMenus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} sheetNumber={menu.sheet} />
            ))}
          </div>
        )}

        {/* TAB 4: SWEETS, SALADS & DRINKS */}
        {activeTab === "sweets" && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sweetsAndSides.map((menu) => (
              <MenuCard key={menu.id} menu={menu} />
            ))}
          </div>
        )}

        {/* Bottom Booking Terms Reference Banner */}
        <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-surface-low border border-line/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
          <div>
            <span className="text-xs uppercase tracking-widest text-gold font-semibold block mb-1">
              Important Notice
            </span>
            <h4 className="font-display text-xl text-ink font-semibold">
              Booking Terms &amp; Conditions Apply
            </h4>
            <p className="text-xs sm:text-sm text-ink-soft mt-1 leading-relaxed max-w-2xl">
              Catering and decoration from outside are strictly prohibited. Minimum booking guidelines,
              standard 5% service charge, and session guidelines are detailed on the printed card.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <button
              type="button"
              onClick={openTerms}
              className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-11 px-5 rounded transition-all shadow-sm"
            >
              <Icon name="doc" className="w-4 h-4" />
              <span>Read Booking Terms</span>
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX FOR MENU CARDS */}
      {isLightboxOpen && currentLightboxSheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Menu card preview: ${currentLightboxSheet.title}`}
          className="fixed inset-0 z-[80] bg-night/95 backdrop-blur-md flex flex-col justify-between"
        >
          {/* Top Lightbox Bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 text-white">
            <div className="leading-tight">
              <span className="text-xs text-gold-light uppercase tracking-wider block">
                Sheet {lightboxIndex + 1} of {menuSheets.length}
              </span>
              <p className="font-display text-base sm:text-lg font-medium">
                {currentLightboxSheet.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={menuPdf}
                download
                aria-label="Download menu PDF"
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                title="Download menu PDF"
              >
                <Icon name="download" className="w-5 h-5" />
              </a>
              <button
                ref={closeRef}
                type="button"
                onClick={closeLightbox}
                aria-label="Close menu fullscreen preview"
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-white/10 text-white transition-colors"
              >
                <Icon name="close" className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Central High-Resolution Sheet View */}
          <div className="relative flex-1 min-h-0 w-full p-2 sm:p-6 flex items-center justify-center">
            <div className="relative w-full h-full max-h-[82vh] aspect-[9/13]">
              <Image
                key={currentLightboxSheet.src}
                src={currentLightboxSheet.src}
                alt={`High-resolution menu card: ${currentLightboxSheet.title}`}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>

            {/* Prev / Next Navigation Arrows */}
            <button
              type="button"
              onClick={() => stepLightbox(-1)}
              aria-label="Previous menu sheet"
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-black/60 text-white hover:bg-gold transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Icon name="prev" className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => stepLightbox(1)}
              aria-label="Next menu sheet"
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-full bg-black/60 text-white hover:bg-gold transition-colors focus-visible:ring-2 focus-visible:ring-gold"
            >
              <Icon name="next" className="w-5 h-5" />
            </button>
          </div>

          {/* Bottom Lightbox Controls */}
          <div className="p-4 border-t border-white/10 bg-night/90 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <p className="text-xs text-white/70">
              Printed on the official Sadiq Pearl Marquee card. Use WhatsApp to inquire about current rates.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={getWhatsAppUrl(
                  `Assalam o Alaikum, I am inquiring about per-head rates for Menu Sheet ${lightboxIndex + 1} (${currentLightboxSheet.title}).`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white font-semibold text-xs sm:text-sm h-10 px-5 rounded transition-colors shadow"
              >
                <WhatsAppGlyph className="w-4 h-4 fill-current" />
                <span>Inquire on WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={closeLightbox}
                className="inline-flex items-center justify-center text-xs text-white/80 hover:text-white px-3 py-2"
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

/** Individual transcribed menu card component */
function MenuCard({
  menu,
  sheetNumber,
}: {
  menu: MenuSet;
  sheetNumber?: number;
}) {
  const cardWaUrl = getWhatsAppUrl(
    `Assalam o Alaikum, I would like to inquire about the per-head rate for ${menu.title} at Sadiq Pearl Marquee.`
  );

  return (
    <article className="bg-surface rounded-2xl border border-line/70 hover:border-gold/60 p-6 flex flex-col justify-between shadow-sm transition-all duration-300 hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-2 pb-3 mb-4 border-b border-line/60">
          <div>
            <h4 className="font-display text-xl text-ink font-semibold">
              {menu.title}
            </h4>
            {sheetNumber && (
              <span className="text-[10px] text-ink-muted uppercase tracking-wider block mt-0.5">
                Printed on Sheet 0{sheetNumber}
              </span>
            )}
          </div>
          <span className="w-2 h-2 rounded-full bg-gold/60 mt-2 shrink-0" />
        </div>

        <ul className="space-y-2 text-sm text-ink-soft">
          {menu.items.map((item, index) => (
            <li
              key={index}
              className={`flex items-start gap-2 ${
                index === 0 ? "font-semibold text-ink" : ""
              }`}
            >
              <span className="text-gold text-xs mt-1">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 pt-4 border-t border-line/40">
        <a
          href={cardWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ask about ${menu.title} on WhatsApp: 0345 5673921`}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border border-gold/40 hover:border-gold text-gold hover:bg-gold hover:text-white transition-colors text-xs font-semibold"
        >
          <WhatsAppGlyph className="w-3.5 h-3.5 fill-current" />
          <span>Ask per-head rate</span>
        </a>
      </div>
    </article>
  );
}
