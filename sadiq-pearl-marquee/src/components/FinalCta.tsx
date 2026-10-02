import Image from "next/image";
import { business } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import BookingForm from "./BookingForm";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

const steps = [
  "Send your date, event and guest count",
  "Management replies on WhatsApp with availability and menu options",
  "Your date is confirmed by the venue",
];

export default function FinalCta() {
  const whatsappUrl = getWhatsAppUrl(
    "Assalam o Alaikum, I would like to inquire about booking Sadiq Pearl Marquee for an upcoming event."
  );

  return (
    <section id="inquire" aria-labelledby="inquire-title" className="relative isolate overflow-hidden bg-espresso py-20 text-white sm:py-28 lg:py-36">
      <span id="reserve" className="sr-only" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-25">
        <Image src="/images/gallery/chandelier-hall.jpg" alt="" fill sizes="100vw" className="object-cover" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-b from-espresso via-espresso/90 to-espresso" />

      <div className="container-px mx-auto grid max-w-content gap-12 grid-cols-1 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionHead
            id="inquire-title"
            tone="dark"
            eyebrow="Book Your Event"
            title={
              <>
                Ask about your <em className="text-gold-light">date</em>
              </>
            }
            intro="Tell us about your wedding, reception or family gathering. Management will reply on WhatsApp with availability and per-head menu options."
          />

          <ol data-reveal className="mt-10 space-y-5">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-gold-light/40 font-display text-lg italic text-gold-light">
                  {i + 1}
                </span>
                <span className="pt-1.5 text-[0.9375rem] leading-relaxed text-white/80">{s}</span>
              </li>
            ))}
          </ol>

          <div data-reveal className="mt-10 space-y-3 border-t border-white/10 pt-8 text-sm">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center gap-3 font-semibold text-gold-light hover:text-white"
            >
              <WhatsAppGlyph className="h-5 w-5" />
              WhatsApp {WHATSAPP_DISPLAY_NUMBER}
            </a>
            {business.phones.map((p) => (
              <a key={p.href} href={p.href} className="flex min-h-[44px] items-center gap-3 text-white/80 hover:text-white">
                <Icon name="phone" className="h-5 w-5 text-gold-light" />
                {p.display}
              </a>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div data-reveal="depth" className="rounded-3xl bg-surface p-6 text-ink shadow-frame sm:p-8 lg:p-10">
            <BookingForm />
          </div>
        </div>
      </div>
    </section>
  );
}
