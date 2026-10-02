import { BookingProvider } from "@/components/BookingContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QuickActions from "@/components/QuickActions";
import BookingModal from "@/components/BookingModal";
import TermsSheet from "@/components/TermsSheet";
import MotionEffects from "@/components/MotionEffects";
import { jsonLdHtml, venueJsonLd, websiteJsonLd } from "@/lib/seo";

// Public-site chrome shared by every public page. Overlays (inquiry modal,
// terms) live here once, so no page can forget to mount them.
// Structured data: the venue and the website, from real configured data only
// (see src/lib/seo.ts). No self-assigned rating.
const structuredData = jsonLdHtml([venueJsonLd(), websiteJsonLd()]);

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <BookingProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-espresso focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-surface"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">{children}</main>
      <Footer />
      <QuickActions />
      <BookingModal />
      <TermsSheet />
      <MotionEffects />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </BookingProvider>
  );
}
