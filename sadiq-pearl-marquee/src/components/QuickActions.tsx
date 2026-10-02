"use client";

import { useSyncExternalStore } from "react";
import { business } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import BookNowButton from "./BookNowButton";
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
 * Mobile: a bottom action bar (Call · WhatsApp · Book).
 * Desktop: a discreet floating WhatsApp button.
 */
export default function QuickActions() {
  const shown = useSyncExternalStore(subscribe, getShown, getServerShown);
  const whatsappUrl = getWhatsAppUrl();

  return (
    <>
      <div
        inert={!shown}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/95 px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-12px_32px_-20px_rgba(30,25,21,0.45)] backdrop-blur-xl transition-transform duration-500 ease-elegant lg:hidden ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-md items-stretch gap-2">
          <a
            href={business.phoneHref}
            className="flex min-h-[48px] w-[4.25rem] flex-col items-center justify-center rounded-xl text-[0.6875rem] font-semibold text-ink-soft"
          >
            <Icon name="phone" className="mb-0.5 h-5 w-5 text-gold" />
            Call
          </a>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${WHATSAPP_DISPLAY_NUMBER}`}
            className="flex min-h-[48px] w-[4.25rem] flex-col items-center justify-center rounded-xl text-[0.6875rem] font-semibold text-ink-soft"
          >
            <WhatsAppGlyph className="mb-0.5 h-5 w-5 text-gold" />
            WhatsApp
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
        inert={!shown}
        aria-label={`Chat on WhatsApp: ${WHATSAPP_DISPLAY_NUMBER}`}
        className={`fixed bottom-6 right-6 z-40 hidden items-center gap-2.5 rounded-full bg-gold-light py-3 pl-4 pr-5 text-sm font-semibold text-espresso shadow-lift ring-1 ring-espresso/10 transition-[opacity,transform,background-color] duration-500 ease-elegant hover:bg-gold-pale lg:inline-flex ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <WhatsAppGlyph className="h-5 w-5" />
        WhatsApp
      </a>
    </>
  );
}
