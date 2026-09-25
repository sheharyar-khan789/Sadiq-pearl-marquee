"use client";

import { terms } from "@/data/menu";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import { useBooking } from "./BookingContext";
import Icon, { WhatsAppGlyph } from "./Icon";
import { useDialog } from "./useDialog";

export default function TermsSheet() {
  const { termsOpen, closeTerms } = useBooking();
  const closeRef = useDialog(termsOpen, closeTerms);
  if (!termsOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="terms-title">
      <div className="absolute inset-0 bg-night/60" onClick={closeTerms} />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-surface rounded-t-2xl sm:rounded-xl shadow-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p lang="ur" dir="rtl" className="text-gold text-lg">شرائط و ضوابط</p>
            <h2 id="terms-title" className="font-display text-3xl text-ink">Booking terms</h2>
          </div>
          <button ref={closeRef} type="button" onClick={closeTerms} aria-label="Close terms" className="w-10 h-10 grid place-items-center rounded hover:bg-surface-mid shrink-0"><Icon name="close" /></button>
        </div>
        <p className="text-sm text-ink-soft mb-6">Translated from the Urdu terms on our printed menu card.</p>
        <ol className="space-y-5">
          {terms.map((t, i) => (
            <li key={t.title} className="flex gap-4">
              <span className="font-display text-xl text-gold-container w-7 shrink-0">{i + 1}</span>
              <div><h3 className="font-semibold text-ink">{t.title}</h3><p className="text-sm leading-6 text-ink-soft">{t.body}</p></div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href={getWhatsAppUrl("Assalam o Alaikum, I have a question about Sadiq Pearl Marquee booking terms.")} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-gold text-white font-semibold h-12 px-6 rounded hover:bg-gold-container transition-colors"><WhatsAppGlyph /> Ask a question</a>
          <button type="button" onClick={closeTerms} className="h-12 px-6 rounded border border-gold text-gold font-semibold hover:bg-gold hover:text-white transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
