"use client";

import { useEffect, useState } from "react";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { WhatsAppGlyph } from "./Icon";

export default function WhatsAppButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Subtle entrance: show after 800ms initial mount
    const timer = setTimeout(() => {
      setVisible(true);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I am interested in Sadiq Pearl Marquee and would like to ask about booking availability."
  );

  return (
    <aside aria-label="Quick contact" className="pointer-events-none">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Inquire on WhatsApp: 0345 5673921"
        title="Chat with Sadiq Pearl Marquee on WhatsApp (0345 5673921)"
        className={`pointer-events-auto fixed z-40 bottom-5 right-5 sm:bottom-6 sm:right-6 safe-bottom flex items-center gap-2.5 bg-gold hover:bg-gold-container text-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-full shadow-lg hover:shadow-2xl transition-all duration-500 ease-elegant border border-white/20 focus-visible:ring-4 focus-visible:ring-gold/50 ${
          visible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-4 scale-95"
        }`}
      >
        <span className="relative flex items-center justify-center">
          <WhatsAppGlyph className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-gold-light animate-ping" />
        </span>
        <span className="font-semibold text-xs sm:text-sm tracking-wide hidden sm:inline">
          Inquire on WhatsApp
        </span>
        <span className="font-semibold text-xs tracking-wide sm:hidden">
          WhatsApp
        </span>
      </a>
    </aside>
  );
}
