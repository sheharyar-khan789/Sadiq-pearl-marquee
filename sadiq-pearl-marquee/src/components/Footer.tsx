"use client";

import Image from "next/image";
import { business, media } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import Icon, { Stars, TikTokGlyph, WhatsAppGlyph } from "./Icon";

const footerLinks = [
  ["/#home", "Home"],
  ["/#about", "About"],
  ["/#features", "Venue / Features"],
  ["/#events", "Events"],
  ["/#menus", "Menu"],
  ["/gallery", "Gallery"],
  ["/#contact", "Contact"],
];

export default function Footer() {
  const { openTerms } = useBooking();
  const whatsappUrl = getWhatsAppUrl();

  return (
    <footer className="bg-night text-surface pt-16 pb-24 md:pb-12 border-t border-gold/20">
      <div className="max-w-content mx-auto container-px">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Column 1: Branding & Verified Google Rating */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Image
                src={media.logo}
                alt="Sadiq Pearl Marquee logo"
                width={44}
                height={44}
                className="w-11 h-11 rounded object-cover shadow ring-1 ring-gold/30"
              />
              <span className="font-display text-xl text-white font-medium">
                SADIQ PEARL
                <span className="block text-[10px] tracking-[0.18em] text-gold-light font-body font-semibold">
                  MARQUEE
                </span>
              </span>
            </div>
            <p className="text-sm text-surface/75 leading-relaxed mb-4">
              Premium wedding and event venue on Rashidpur–Orangabad Road in Kakrot, Sarai Alamgir.
            </p>
            <p className="flex items-center gap-2 text-sm text-surface/85">
              <Stars value={business.rating} className="w-3.5 h-3.5 text-gold-light" />
              <span>{business.rating} · {business.reviewCount} Google reviews</span>
            </p>
          </div>

          {/* Column 2: Navigation */}
          <nav aria-label="Footer navigation">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light mb-4">
              Navigation
            </p>
            <ul className="space-y-2 text-sm">
              {footerLinks.map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    className="text-surface/80 hover:text-gold-light transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
              <li className="pt-1">
                <button
                  type="button"
                  onClick={openTerms}
                  className="text-surface/80 hover:text-gold-light transition-colors"
                >
                  Booking terms
                </button>
              </li>
            </ul>
          </nav>

          {/* Column 3: Contact & Direct Inquiries */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light mb-4">
              Direct Contact
            </p>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Inquire on WhatsApp: 0345 5673921"
                  className="inline-flex items-center gap-2 text-gold-light hover:text-gold font-medium transition-colors"
                >
                  <WhatsAppGlyph className="w-4 h-4 fill-current" />
                  <span>WhatsApp: 0345 5673921</span>
                </a>
              </li>
              {business.phones.map((phone) => (
                <li key={phone.href}>
                  <a
                    href={phone.href}
                    className="inline-flex items-center gap-2 text-surface/80 hover:text-gold-light transition-colors"
                  >
                    <Icon name="phone" className="w-4 h-4 text-gold-light" />
                    <span>{phone.display}</span>
                  </a>
                </li>
              ))}
              {business.social.tiktok && (
                <li className="pt-1">
                  <a
                    href={business.social.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-surface/80 hover:text-gold-light transition-colors"
                  >
                    <TikTokGlyph className="w-4 h-4 fill-current text-gold-light" />
                    <span>TikTok: {business.social.tiktokHandle}</span>
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 4: Address & Google Maps */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-light mb-4">
              Location &amp; Maps
            </p>
            <address className="not-italic text-sm text-surface/80 leading-relaxed mb-3">
              {business.addressLine1},<br />
              {business.addressLine2}
            </address>
            <a
              href={business.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Sadiq Pearl Marquee location in Google Maps"
              className="inline-flex items-center gap-2 text-sm text-gold-light hover:underline font-medium"
            >
              <Icon name="pin" className="w-4 h-4" />
              <span>Get Directions on Google Maps</span>
            </a>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-surface/70">
              <Icon name="parking" className="w-4 h-4 text-gold-light" />
              <span>Free on-site &amp; street parking</span>
            </p>
          </div>
        </div>

        <p className="border-t border-surface/15 pt-6 text-xs text-surface/60">
          © {business.copyrightYear} {business.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
