import { BookingProvider } from "@/components/BookingContext";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Highlights from "@/components/Highlights";
import Events from "@/components/Events";
import Menus from "@/components/Menus";
import Videos from "@/components/Videos";
import TermsSheet from "@/components/TermsSheet";
import Gallery from "@/components/Gallery";
import Reviews from "@/components/Reviews";
import Location from "@/components/Location";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import BookingModal from "@/components/BookingModal";

export default function Home() {
  return (
    <BookingProvider>
      <Navbar />
      <main>
        <Hero />
        <About />
        <Highlights />
        <Events />
        <Menus />
        <Gallery />
        <Videos />
        <Reviews />
        <Location />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppButton />
      <BookingModal />
      <TermsSheet />
    </BookingProvider>
  );
}
