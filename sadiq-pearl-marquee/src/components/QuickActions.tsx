"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { business } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import BookNowButton, { BOOK_PATH } from "./BookNowButton";
import Icon, { WhatsAppGlyph } from "./Icon";

function subscribe(cb: () => void) {
  window.addEventListener("scroll", cb, { passive: true });
  window.addEventListener("resize", cb, { passive: true });
  return () => {
    window.removeEventListener("scroll", cb);
    window.removeEventListener("resize", cb);
  };
}
// Appear once the visitor has moved past most of the first screen, so the
// bar never duplicates the hero's own call-to-action buttons.
const getShown = () => window.scrollY > window.innerHeight * 0.6;
const getServerShown = () => false;

/**
 * Sticky WhatsApp button on every public page, plus a mobile bottom bar
 * (Call · Book) once the visitor scrolls. On the booking page, phones get
 * neither (the page has its own WhatsApp link), so nothing sits over the
 * booking form's full-width buttons; desktop keeps the button in the margin.
 */
export default function QuickActions() {
  const scrolled = useSyncExternalStore(subscribe, getShown, getServerShown);
  const onBookPage = usePathname() === BOOK_PATH;
  const barShown = scrolled && !onBookPage;
  const whatsappUrl = getWhatsAppUrl();

  return (
    <>
      <div
        inert={!barShown}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_32px_-20px_rgba(30,25,21,0.45)] backdrop-blur-xl transition-transform duration-500 ease-elegant lg:hidden ${
          barShown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Right padding keeps the bar's buttons clear of the WhatsApp button above it. */}
        <div className="mx-auto flex max-w-md items-stretch gap-2 pr-16">
          <a
            href={business.phoneHref}
            className="flex min-h-[48px] w-[4.25rem] flex-col items-center justify-center rounded-xl text-[0.6875rem] font-semibold text-ink-soft"
          >
            <Icon name="phone" className="mb-0.5 h-5 w-5 text-gold" />
            Call
          </a>
          <BookNowButton className="btn btn-primary flex-1 !min-h-[48px] !px-4 text-[0.875rem]">
            <span className="min-[360px]:hidden">Book Event</span>
            <span className="hidden min-[360px]:inline">Book Your Event</span>
          </BookNowButton>
        </div>
      </div>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chat on WhatsApp: ${WHATSAPP_DISPLAY_NUMBER}`}
        className={`fixed right-4 z-40 h-14 w-14 ${onBookPage ? "hidden lg:inline-flex" : "inline-flex"} items-center justify-center gap-2.5 rounded-full bg-gold-light text-espresso shadow-lift ring-1 ring-espresso/10 transition-[bottom,background-color] duration-500 ease-elegant hover:bg-gold-pale sm:right-6 lg:bottom-6 lg:h-auto lg:w-auto lg:py-3 lg:pl-4 lg:pr-5 ${
          barShown ? "bottom-[calc(0.625rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <WhatsAppGlyph className="h-6 w-6 lg:h-5 lg:w-5" />
        <span className="hidden text-sm font-semibold lg:inline">WhatsApp</span>
      </a>
    </>
  );
}
