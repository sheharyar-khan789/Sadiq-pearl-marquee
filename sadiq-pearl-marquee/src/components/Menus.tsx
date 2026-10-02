"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { menuPdf, menuSheets, mehndiMenus, sweetsAndSides, weddingMenus, type MenuSet } from "@/data/menu";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import SectionHead from "./Section";
import { useDialog } from "./useDialog";
import Icon, { WhatsAppGlyph } from "./Icon";

// Printed on every wedding menu (see data/menu.ts); listed once for readability.
const WEDDING_INCLUDES = ["Roghni Naan", "Green Salad", "Raita", "Soft Drink", "Mineral Water"];

const tabs = [
  { key: "wedding", label: "Wedding menus", count: weddingMenus.length },
  { key: "mehndi", label: "Mehndi menus", count: mehndiMenus.length },
  { key: "sweets", label: "Desserts & drinks", count: sweetsAndSides.length },
  { key: "card", label: "Printed card", count: menuSheets.length },
] as const;
type TabKey = (typeof tabs)[number]["key"];

export default function Menus() {
  const [active, setActive] = useState<TabKey>("wedding");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { openTerms } = useBooking();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeLightbox = useCallback(() => setLightbox(null), []);
  const closeRef = useDialog(lightbox !== null, closeLightbox, dialogRef);
  const step = useCallback(
    (d: number) => setLightbox((c) => (c === null ? null : (c + d + menuSheets.length) % menuSheets.length)),
    []
  );

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, step]);

  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : e.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(tabs[next].key);
    tabRefs.current[next]?.focus();
  };

  const sheet = lightbox !== null ? menuSheets[lightbox] : null;

  return (
    <section id="menus" aria-labelledby="menus-title" className="bg-surface-low py-20 sm:py-28 lg:py-36">
      <div className="container-px mx-auto max-w-content">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHead
            id="menus-title"
            eyebrow="Catering & Menus"
            title={
              <>
                Traditional Pakistani <em className="text-gold">catering</em>
              </>
            }
            intro="Wedding and mehndi menus from our printed menu card, prepared in-house and served at your tables. Ask us for current per-head rates."
          />
          <div data-reveal data-reveal-delay="120" className="flex flex-wrap gap-3">
            <a
              href={getWhatsAppUrl(
                "Assalam o Alaikum, I would like to inquire about the menu options and per-head rates at Sadiq Pearl Marquee."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              <WhatsAppGlyph className="h-[18px] w-[18px]" />
              Ask for menu rates
            </a>
            <a href={menuPdf} download className="btn btn-outline">
              <Icon name="download" className="h-4 w-4" />
              Menu card (PDF)
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Menu categories"
          className="no-scrollbar -mx-5 mt-12 flex gap-2 overflow-x-auto px-5 sm:mx-0 sm:flex-wrap sm:px-0 lg:mt-14"
        >
          {tabs.map((t, i) => {
            const selected = active === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`menu-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`menu-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(t.key)}
                onKeyDown={(e) => onTabKey(e, i)}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors ${
                  selected
                    ? "border-espresso bg-espresso text-surface"
                    : "border-line-strong/50 bg-surface text-ink-soft hover:border-ink/50 hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`text-xs ${selected ? "text-gold-light" : "text-ink-muted"}`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`menu-panel-${active}`}
          aria-labelledby={`menu-tab-${active}`}
          tabIndex={0}
          className="mt-8 focus-visible:outline-offset-8"
        >
          {active === "wedding" && (
            <>
              <p className="mb-6 flex items-start gap-2 text-sm text-ink-soft">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                Every wedding menu includes {WEDDING_INCLUDES.slice(0, -1).join(", ").toLowerCase()} and{" "}
                {WEDDING_INCLUDES[WEDDING_INCLUDES.length - 1].toLowerCase()}.
              </p>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {weddingMenus.map((m, i) => (
                  <MenuCard key={m.id} menu={m} index={i} hideItems={WEDDING_INCLUDES} />
                ))}
                <li className="flex flex-col justify-between rounded-2xl bg-espresso p-6 text-white">
                  <div>
                    <p className="text-eyebrow font-semibold uppercase text-gold-light">Need help choosing?</p>
                    <p className="mt-3 font-display text-[1.625rem] leading-tight">
                      Ask for current per-head rates for any menu.
                    </p>
                  </div>
                  <a
                    href={getWhatsAppUrl(
                      "Assalam o Alaikum, I would like help choosing a wedding menu and the current per-head rates."
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-accent btn-sm mt-6 self-start"
                  >
                    <WhatsAppGlyph className="h-4 w-4" />
                    Ask on WhatsApp
                  </a>
                </li>
              </ul>
            </>
          )}
          {active === "mehndi" && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-4xl">
              {mehndiMenus.map((m, i) => (
                <MenuCard key={m.id} menu={m} index={i} />
              ))}
            </ul>
          )}
          {active === "sweets" && (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sweetsAndSides.map((m, i) => (
                <MenuCard key={m.id} menu={m} index={i} plain />
              ))}
            </ul>
          )}
          {active === "card" && (
            <>
              <p className="mb-6 max-w-2xl text-sm text-ink-soft">
                Photographs of the printed menu card, with Urdu dish names. Tap a sheet to enlarge it.
              </p>
              <ul className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
                {menuSheets.map((s, i) => (
                  <li key={s.src} className="w-[72%] shrink-0 snap-center sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setLightbox(i)}
                      aria-haspopup="dialog"
                      className="group block w-full text-left"
                    >
                      <span className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-surface-high shadow-soft ring-1 ring-line">
                        <Image
                          src={s.src}
                          alt={`Printed menu card, sheet ${i + 1}: ${s.title}`}
                          fill
                          sizes="(min-width: 640px) 30vw, 72vw"
                          className="object-cover transition-transform duration-700 ease-elegant group-hover:scale-[1.03]"
                        />
                        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-espresso/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
                          <Icon name="expand" className="h-3.5 w-3.5 text-gold-light" />
                          Enlarge
                        </span>
                      </span>
                      <span className="mt-3 block text-sm font-semibold text-ink">Sheet {i + 1}</span>
                      <span className="block text-xs text-ink-muted">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Terms summary — every point is from the printed card */}
        <div
          data-reveal
          className="mt-14 flex flex-col gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <p className="eyebrow">Good to know</p>
            <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm text-ink-soft sm:grid-cols-3">
              <li className="flex gap-2">
                <span className="text-gold">·</span> Rates are based on 300+ guests; an extra per-head charge applies below that
              </li>
              <li className="flex gap-2">
                <span className="text-gold">·</span> Outside catering &amp; decoration not allowed
              </li>
              <li className="flex gap-2">
                <span className="text-gold">·</span> 5% service charge applies
              </li>
            </ul>
          </div>
          <button type="button" onClick={openTerms} aria-haspopup="dialog" className="btn btn-outline shrink-0">
            <Icon name="doc" className="h-4 w-4" />
            Read all booking terms
          </button>
        </div>
      </div>

      {/* Printed-card lightbox */}
      {sheet && lightbox !== null && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Menu card sheet ${lightbox + 1}: ${sheet.title}`}
          className="fixed inset-0 z-[80] flex flex-col bg-espresso/95 text-white backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-eyebrow font-semibold uppercase text-gold-light">
                Sheet {lightbox + 1} of {menuSheets.length}
              </p>
              <p className="font-display text-lg">{sheet.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={menuPdf}
                download
                aria-label="Download menu card PDF"
                className="grid h-11 w-11 place-items-center rounded-full text-white/80 hover:bg-white/10"
              >
                <Icon name="download" className="h-5 w-5" />
              </a>
              <button
                ref={closeRef}
                type="button"
                onClick={closeLightbox}
                aria-label="Close"
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 hover:bg-white/10"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 p-3 sm:p-6">
            <Image
              key={sheet.src}
              src={sheet.src}
              alt={`Printed menu card, sheet ${lightbox + 1}: ${sheet.title}`}
              fill
              sizes="100vw"
              className="object-contain p-3 sm:p-6"
            />
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous sheet"
              className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Icon name="prev" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next sheet"
              className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Icon name="next" className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function MenuCard({
  menu,
  index,
  hideItems,
  plain,
}: {
  menu: MenuSet;
  index: number;
  hideItems?: string[];
  plain?: boolean;
}) {
  const items = hideItems ? menu.items.filter((i) => !hideItems.includes(i)) : menu.items;
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-surface p-6 transition-shadow duration-500 hover:shadow-soft">
      <div className="flex items-baseline justify-between gap-3 border-b border-line pb-4">
        <h3 className="font-display text-[1.625rem] leading-none text-ink">{menu.title}</h3>
        {!plain && <span className="font-display text-sm italic text-gold">{String(index + 1).padStart(2, "0")}</span>}
      </div>
      <ul className="mt-4 flex-1 space-y-2 text-[0.9375rem] text-ink-soft">
        {items.map((item, i) => (
          <li key={item} className={`flex gap-2.5 ${i === 0 && !plain ? "font-semibold text-ink" : ""}`}>
            <span aria-hidden="true" className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-gold-container" />
            {item}
          </li>
        ))}
      </ul>
      {!plain && (
        <a
          href={getWhatsAppUrl(
            `Assalam o Alaikum, I would like to inquire about the per-head rate for ${menu.title} at Sadiq Pearl Marquee.`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 self-start text-sm font-semibold text-gold transition-colors hover:text-ink"
        >
          <WhatsAppGlyph className="h-4 w-4" />
          <span className="link-underline">Ask per-head rate</span>
        </a>
      )}
    </li>
  );
}
