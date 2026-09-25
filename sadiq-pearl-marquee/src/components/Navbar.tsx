"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import Icon, { Stars, WhatsAppGlyph } from "./Icon";

export interface NavLinkItem {
  href: string;
  label: string;
  longLabel: string;
}

export const navLinks: NavLinkItem[] = [
  { href: "#home", label: "Home", longLabel: "Home" },
  { href: "#about", label: "About", longLabel: "About Sadiq Pearl" },
  { href: "#features", label: "Venue / Features", longLabel: "Venue & Features" },
  { href: "#events", label: "Events", longLabel: "Events & Celebrations" },
  { href: "#menus", label: "Menu", longLabel: "Catering & Menus" },
  { href: "#gallery", label: "Gallery", longLabel: "Photo Gallery" },
  { href: "#contact", label: "Contact", longLabel: "Contact & Location" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      closeRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  const go = useCallback((e: React.MouseEvent, href: string) => {
    setOpen(false);

    // If target element exists on this page, smooth scroll
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } else if (href.startsWith("#")) {
      e.preventDefault();
      window.location.href = `/${href}`;
    }
  }, []);

  const whatsappInquiryUrl = getWhatsAppUrl();

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-surface/95 backdrop-blur-md shadow-sm border-b border-line/60 py-2.5"
            : "bg-surface/90 backdrop-blur-sm border-b border-line/40 py-3.5"
        }`}
      >
        <div className="max-w-content mx-auto container-px flex items-center justify-between gap-4">
          {/* Logo */}
          <a
            href="#home"
            onClick={(e) => go(e, "#home")}
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0 focus-visible:ring-2 focus-visible:ring-gold"
            aria-label={`${business.name} — return to top`}
          >
            <Image
              src={media.logo}
              alt="Sadiq Pearl Marquee logo"
              width={40}
              height={40}
              priority
              className="w-9 h-9 sm:w-10 sm:h-10 rounded object-cover shadow-sm ring-1 ring-gold/25"
            />
            <span className="leading-tight">
              <span className="block font-display text-base sm:text-lg tracking-wide text-ink group-hover:text-gold transition-colors font-medium">
                SADIQ PEARL
              </span>
              <span className="block whitespace-nowrap text-[9px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] text-gold font-semibold">
                Marquee · Sarai Alamgir
              </span>
            </span>
          </a>

          {/* Desktop Navigation Links */}
          <nav
            className="hidden lg:flex items-center gap-4 xl:gap-7"
            aria-label="Primary navigation"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => go(e, item.href)}
                className="text-xs xl:text-sm font-medium text-ink-soft hover:text-gold transition-colors py-1.5 border-b-2 border-transparent hover:border-gold/50"
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* Desktop & Mobile Actions */}
          <div className="flex items-center gap-2">
            {/* Primary WhatsApp CTA on Desktop */}
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire on WhatsApp (0345 5673921)"
              className="hidden lg:inline-flex items-center gap-2 bg-gold hover:bg-gold-container text-white text-xs xl:text-sm font-semibold px-4 h-10 rounded transition-all shadow-sm active:scale-95"
            >
              <WhatsAppGlyph className="w-4 h-4 fill-current shrink-0" />
              <span>Inquire on WhatsApp</span>
            </a>

            {/* Direct Quick WhatsApp for Mobile */}
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Inquire on WhatsApp: 0345 5673921"
              className="lg:hidden w-10 h-10 grid place-items-center text-gold hover:bg-surface-mid rounded-full transition-colors"
            >
              <WhatsAppGlyph className="w-5 h-5 fill-current" />
            </a>

            {/* Mobile Hamburger Menu Button */}
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="lg:hidden w-10 h-10 grid place-items-center text-ink hover:bg-surface-mid rounded transition-colors"
            >
              <Icon name="menu" className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Dialog */}
      <div
        className={`fixed inset-0 z-[60] lg:hidden transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* Backdrop overlay */}
        <div
          onClick={() => setOpen(false)}
          className="absolute inset-0 bg-night/60 backdrop-blur-sm transition-opacity"
        />

        {/* Slide-over panel */}
        <aside
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={`absolute right-0 top-0 h-full w-[88%] max-w-sm bg-surface shadow-2xl overflow-y-auto flex flex-col justify-between transition-transform duration-400 ease-elegant ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div>
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-5 border-b border-line/60 bg-surface-low">
              <div className="flex items-center gap-3">
                <Image
                  src={media.logo}
                  alt="Sadiq Pearl Marquee logo"
                  width={42}
                  height={42}
                  className="w-10 h-10 rounded object-cover shadow-sm ring-1 ring-gold/20"
                />
                <div className="leading-tight">
                  <p className="font-display text-base font-semibold text-ink">
                    SADIQ PEARL
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <Stars value={business.rating} className="w-3 h-3 text-gold" />
                    <span>
                      {business.rating} · {business.reviewCount} Google reviews
                    </span>
                  </div>
                </div>
              </div>

              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-surface-mid text-ink-soft hover:text-ink transition-colors"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Nav Links */}
            <nav className="p-5" aria-label="Mobile site sections">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold mb-3 px-1">
                Navigation
              </p>
              <ul className="space-y-1">
                {navLinks.map((item, index) => (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      onClick={(e) => go(e, item.href)}
                      className="flex items-center justify-between min-h-[48px] px-3.5 py-3 rounded-lg text-ink font-medium text-base hover:text-gold hover:bg-surface-mid/60 transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gold/80 w-5">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>{item.longLabel}</span>
                      </span>
                      <Icon name="arrow" className="w-4 h-4 text-ink-soft/60" />
                    </a>
                  </li>
                ))}
              </ul>

              {/* Mobile WhatsApp CTA Button */}
              <div className="mt-6 pt-4 border-t border-line/50">
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-container text-white font-semibold h-12 rounded-lg transition-colors shadow-md"
                  aria-label="Inquire on WhatsApp (0345 5673921)"
                >
                  <WhatsAppGlyph className="w-5 h-5 fill-current" />
                  <span>Inquire on WhatsApp</span>
                </a>
              </div>
            </nav>
          </div>

          {/* Drawer Footer Information */}
          <div className="p-5 bg-surface-low border-t border-line/60 space-y-3 text-xs text-ink-soft">
            <p className="font-semibold uppercase tracking-wider text-ink text-[10px]">
              Direct Contact
            </p>
            <div className="space-y-1.5">
              {business.phones.map((phone) => (
                <a
                  key={phone.href}
                  href={phone.href}
                  className="flex items-center gap-2.5 text-ink hover:text-gold transition-colors py-1"
                >
                  <Icon name="phone" className="w-4 h-4 text-gold shrink-0" />
                  <span>{phone.display}</span>
                </a>
              ))}
              <a
                href={whatsappInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-ink hover:text-gold transition-colors py-1"
              >
                <WhatsAppGlyph className="w-4 h-4 text-gold shrink-0" />
                <span>WhatsApp: 0345 5673921</span>
              </a>
            </div>
            <p className="flex items-start gap-2.5 pt-2 border-t border-line/40 text-ink-muted">
              <Icon name="pin" className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              <span>{business.fullAddress}</span>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
