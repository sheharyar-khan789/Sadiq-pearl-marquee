import { business } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";
import SectionHead from "./Section";
import BookingForm from "./BookingForm";
import Icon, { WhatsAppGlyph } from "./Icon";

export default function FinalCta() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about booking Sadiq Pearl Marquee for an upcoming event."
  );

  return (
    <section id="inquire" className="bg-surface-low py-16 md:py-24 scroll-mt-20 border-b border-line/40">
      <span id="reserve" className="sr-only" />
      <div className="max-w-content mx-auto container-px grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left Column: Context & Direct Contact Options */}
        <div className="lg:col-span-5 space-y-6">
          <SectionHead
            eyebrow="Event Inquiry"
            title="Ask About Your Date &amp; Arrangements"
            intro="Tell us about your upcoming wedding, reception, or family gathering. Our management will respond directly on WhatsApp with availability and per-head menu options."
          />

          <div className="p-6 rounded-2xl bg-surface border border-line/70 shadow-sm space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-gold font-semibold">
              Immediate Assistance
            </h4>

            <div>
              <p className="text-xs text-ink-muted mb-1">Direct Phone Contact:</p>
              <div className="flex flex-col gap-1.5">
                {business.phones.map((phone) => (
                  <a
                    key={phone.href}
                    href={phone.href}
                    className="inline-flex items-center gap-2 text-ink hover:text-gold transition-colors font-semibold text-sm"
                  >
                    <Icon name="phone" className="w-4 h-4 text-gold shrink-0" />
                    <span>{phone.display}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-line/50">
              <p className="text-xs text-ink-muted mb-1.5">Direct WhatsApp Line:</p>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Direct message on WhatsApp: 0345 5673921"
                className="inline-flex items-center gap-2 text-gold hover:text-gold-container transition-colors font-semibold text-sm"
              >
                <WhatsAppGlyph className="w-4 h-4 fill-current shrink-0" />
                <span>0345 5673921</span>
              </a>
            </div>

            <div className="pt-3 border-t border-line/50 text-xs text-ink-muted leading-relaxed">
              <span>Location: {business.addressLine1}, {business.addressLine2}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Inquiry Form */}
        <div className="lg:col-span-7 bg-surface rounded-2xl border border-line/70 p-6 sm:p-8 lg:p-10 shadow-sm">
          <BookingForm />
        </div>
      </div>
    </section>
  );
}
