"use client";

import Image from "next/image";
import Link from "next/link";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import { navLinks } from "./Navbar";
import Icon, { Stars, TikTokGlyph, WhatsAppGlyph } from "./Icon";

export default function Footer() {
  const { openTerms } = useBooking();

  return (
    <footer className="relative overflow-hidden bg-espresso text-white">
      <div aria-hidden="true" className="hairline opacity-30" />
      {/* Bottom padding keeps the last row clear of the fixed quick-action bar / WhatsApp button. */}
      <div className="container-px mx-auto max-w-content pb-28 pt-16 sm:pt-20">
        <div className="grid gap-12 grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-4">
              <span className="relative h-14 w-14 overflow-hidden rounded-full ring-1 ring-gold-light/40">
                <Image src={media.logo} alt="" fill sizes="56px" className="object-cover" />
              </span>
              <p className="leading-none">
                <span className="block font-display text-3xl">Sadiq Pearl</span>
                <span className="mt-1.5 block text-[0.625rem] font-semibold uppercase tracking-[0.34em] text-gold-light">
                  Marquee
                </span>
              </p>
            </div>
            <p className="mt-6 max-w-xs font-display text-xl italic leading-snug text-white/75">{business.tagline}.</p>
            <p className="mt-6 flex items-center gap-2 text-sm text-white/70">
              <Stars value={business.rating} className="h-3.5 w-3.5" />
              {business.rating} · {business.reviewCount} Google reviews
            </p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-2">
            <h2 className="text-eyebrow font-semibold uppercase text-gold-light">Explore</h2>
            <ul className="mt-5 space-y-1">
              {navLinks.map((l) => (
                <li key={l.id}>
                  <a href={`/#${l.id}`} className="inline-flex min-h-[40px] items-center text-sm text-white/75 hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link href="/gallery" className="inline-flex min-h-[40px] items-center text-sm text-white/75 hover:text-white">
                  Full gallery
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="inline-flex min-h-[40px] items-center text-sm text-white/75 hover:text-white">
                  Guest reviews
                </Link>
              </li>
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="text-eyebrow font-semibold uppercase text-gold-light">Contact</h2>
            <ul className="mt-5 space-y-1 text-sm">
              <li>
                <a
                  href={getWhatsAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center gap-2.5 font-semibold text-gold-light hover:text-white"
                >
                  <WhatsAppGlyph className="h-4 w-4" />
                  WhatsApp {WHATSAPP_DISPLAY_NUMBER}
                </a>
              </li>
              {business.phones.map((p) => (
                <li key={p.href}>
                  <a href={p.href} className="inline-flex min-h-[40px] items-center gap-2.5 text-white/75 hover:text-white">
                    <Icon name="phone" className="h-4 w-4 text-gold-light" />
                    {p.display}
                  </a>
                </li>
              ))}
              {business.social.tiktok && (
                <li>
                  <a
                    href={business.social.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center gap-2.5 text-white/75 hover:text-white"
                  >
                    <TikTokGlyph className="h-4 w-4 text-gold-light" />
                    {business.social.tiktokHandle}
                  </a>
                </li>
              )}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h2 className="text-eyebrow font-semibold uppercase text-gold-light">Visit</h2>
            <address className="mt-5 text-sm not-italic leading-relaxed text-white/75">
              {business.addressLine1},
              <br />
              {business.addressLine2}
            </address>
            <a
              href={business.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex min-h-[40px] items-center gap-2 text-sm font-semibold text-gold-light hover:text-white"
            >
              <Icon name="pin" className="h-4 w-4" />
              Open in Google Maps
            </a>
            <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
              <Icon name="parking" className="h-4 w-4 text-gold-light" />
              Free on-site &amp; street parking
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {business.copyrightYear} {business.name}. All rights reserved.
          </p>
          <button
            type="button"
            onClick={openTerms}
            aria-haspopup="dialog"
            className="self-start text-white/70 underline-offset-4 hover:text-white hover:underline sm:self-auto"
          >
            Booking terms &amp; conditions
          </button>
        </div>
      </div>
    </footer>
  );
}
