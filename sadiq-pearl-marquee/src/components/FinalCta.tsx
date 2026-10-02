import Image from "next/image";
import { business } from "@/lib/config";
import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import BookNowButton from "./BookNowButton";
import SectionHead from "./Section";
import Icon, { WhatsAppGlyph } from "./Icon";

const steps = [
  "Sign in or create your customer account",
  "Choose a date and an available Day or Night slot",
  "Send your booking request — our team reviews it and contacts you",
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
            intro="See which dates and Day / Night slots are free, then send a booking request for your wedding, reception or family gathering."
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
            <p className="eyebrow">Online booking</p>
            <h3 className="mt-3 font-display text-[2rem] leading-tight text-ink sm:text-[2.25rem]">
              Check availability &amp; <em className="text-gold">request your date</em>
            </h3>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
              Every date shows its Day and Night slots as available or booked. A request holds your slot while our team
              reviews it — nothing is confirmed until we contact you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BookNowButton className="btn btn-primary">
                <Icon name="calendar" className="h-4 w-4" />
                Book Your Event
              </BookNowButton>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                <WhatsAppGlyph className="h-[18px] w-[18px] text-gold" />
                Ask on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
