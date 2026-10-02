import type { Metadata } from "next";
import Hero from "@/components/Hero";
import About from "@/components/About";
import VenueShowcase from "@/components/VenueShowcase";
import DecorReels from "@/components/DecorReels";
import Events from "@/components/Events";
import Menus from "@/components/Menus";
import Gallery from "@/components/Gallery";
import Amenities from "@/components/Amenities";
import Reviews from "@/components/Reviews";
import Location from "@/components/Location";
import FinalCta from "@/components/FinalCta";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir",
  absoluteTitle: true,
  description:
    "A wedding and event venue on Rashidpur–Orangabad Road, Kakrot, Sarai Alamgir — in-house catering, table service and free parking for weddings, mehndi, barat, walima and family celebrations.",
  path: "/",
});

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <VenueShowcase />
      <DecorReels />
      <Events />
      <Menus />
      <Gallery />
      <Amenities />
      <Reviews />
      <Location />
      <FinalCta />
    </>
  );
}
