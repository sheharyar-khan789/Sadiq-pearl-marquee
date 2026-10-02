"use client";

import { useRef } from "react";
import { terms } from "@/data/menu";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import Icon, { WhatsAppGlyph } from "./Icon";
import { useDialog } from "./useDialog";

export default function TermsSheet() {
  const { termsOpen, closeTerms } = useBooking();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useDialog(termsOpen, closeTerms, panelRef);
  if (!termsOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
    >
      <div className="absolute inset-0 animate-fade-in bg-espresso/70 backdrop-blur-sm" onClick={closeTerms} />
      <div
        ref={panelRef}
        className="relative max-h-[92svh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-frame sm:max-w-2xl sm:rounded-3xl sm:p-10"
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <p lang="ur" dir="rtl" className="text-lg text-gold">
              شرائط و ضوابط
            </p>
            <h2 id="terms-title" className="font-display text-[2.25rem] leading-none text-ink">
              Booking terms
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeTerms}
            aria-label="Close terms"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line-strong/50 text-ink hover:bg-surface-mid"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-8 text-sm text-ink-soft">Translated from the Urdu terms on our printed menu card.</p>
        <ol className="divide-y divide-line border-y border-line">
          {terms.map((t, i) => (
            <li key={t.title} className="flex gap-5 py-4">
              <span className="w-6 shrink-0 font-display text-xl italic text-gold">{i + 1}</span>
              <div>
                <h3 className="font-semibold text-ink">{t.title}</h3>
                <p className="mt-0.5 text-sm leading-6 text-ink-soft">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={getWhatsAppUrl("Assalam o Alaikum, I have a question about Sadiq Pearl Marquee booking terms.")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <WhatsAppGlyph className="h-[18px] w-[18px]" />
            Ask a question
          </a>
          <button type="button" onClick={closeTerms} className="btn btn-outline">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
