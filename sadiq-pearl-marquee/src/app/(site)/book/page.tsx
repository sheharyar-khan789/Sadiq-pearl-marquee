import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import BookingRequestFlow from "@/components/booking/BookingRequestFlow";
import { WhatsAppGlyph } from "@/components/Icon";
import { getSessionUser } from "@/lib/auth/server";
import { getSlot, type SlotId } from "@/lib/booking/catalog";
import { loadPublicConfig } from "@/lib/config/config-server";
import { businessToday, isIsoDate } from "@/lib/booking/dates";
import { bookingStore } from "@/lib/booking/server";
import { business } from "@/lib/config";
import { getWhatsAppUrl } from "@/lib/whatsapp";

const title = "Check availability";
const description = `See which dates and Day / Night slots are free at ${business.name} and send a booking request online.`;

// Query variants (?date=…) all canonicalise to /book.
export const metadata: Metadata = pageMetadata({ title, description, path: "/book" });

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  const today = businessToday(new Date());
  const date = typeof params.date === "string" && isIsoDate(params.date) && params.date >= today ? params.date : null;
  const cfg = bookingStore() !== null ? await loadPublicConfig() : null;
  const slot = cfg?.ok ? (getSlot(cfg.config, params.slot)?.id ?? null) : null;

  return (
    <section className="bg-surface-low pb-20 pt-32 sm:pb-28 sm:pt-40">
      <div className="container-px mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-ink">
              Book
            </li>
          </ol>
        </nav>
        <p className="eyebrow mt-8">Book your event</p>
        <h1 className="mt-4 font-display text-[2.5rem] font-medium leading-[1.04] text-ink sm:text-6xl">
          Check <em className="text-gold">availability</em>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-soft sm:text-[1.0625rem]">
          Choose a date and a Day or Night slot, then send us a booking request. Nothing is confirmed until our team
          contacts you.
        </p>

        <div className="mt-10">
          {cfg?.ok ? (
            <BookingRequestFlow
              viewer={{
                signedIn: user !== null,
                emailVerified: user?.emailVerified ?? false,
                name: user?.name ?? null,
                email: user?.email ?? null,
              }}
              today={today}
              config={cfg.config}
              initialDate={date}
              initialSlot={slot as SlotId | null}
            />
          ) : (
            <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
              <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
                Online booking isn&rsquo;t available right now. Please ask us about your date on WhatsApp.
              </p>
              <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-5">
                <WhatsAppGlyph className="h-[18px] w-[18px]" />
                WhatsApp us
              </a>
            </div>
          )}
        </div>

        <p className="mt-8 text-sm text-ink-muted">
          Prefer to talk?{" "}
          <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold underline underline-offset-2">
            WhatsApp us
          </a>{" "}
          or call{" "}
          <a href={business.phoneHref} className="font-semibold text-gold underline underline-offset-2">
            {business.phoneDisplay}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
