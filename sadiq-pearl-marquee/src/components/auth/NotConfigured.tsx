import { getWhatsAppUrl, WHATSAPP_DISPLAY_NUMBER } from "@/lib/whatsapp";
import { WhatsAppGlyph } from "../Icon";

/** Shown instead of auth forms when the Firebase web config is not set. */
export default function NotConfigured() {
  return (
    <div className="space-y-5">
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
        Online accounts aren&rsquo;t available yet. For dates, menus and event inquiries, please message the venue
        directly on WhatsApp.
      </p>
      <a href={getWhatsAppUrl()} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
        <WhatsAppGlyph className="h-[18px] w-[18px]" />
        WhatsApp {WHATSAPP_DISPLAY_NUMBER}
      </a>
    </div>
  );
}
