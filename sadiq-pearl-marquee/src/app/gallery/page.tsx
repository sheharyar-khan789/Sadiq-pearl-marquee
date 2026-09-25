import type { Metadata } from "next";
import GalleryPageClient from "./GalleryPageClient";

export const metadata: Metadata = {
  title: "Photo Gallery | Sadiq Pearl Marquee",
  description:
    "Browse authentic high-resolution photos of Sadiq Pearl Marquee: illuminated crystal halls, royal wedding stages, floral arches, entrance foyers, and banquet dining in Sarai Alamgir.",
  openGraph: {
    title: "Photo Gallery | Sadiq Pearl Marquee",
    description:
      "Authentic photographs of wedding stages, floral arches, banquet halls, and grounds at Sadiq Pearl Marquee, Kakrot, Sarai Alamgir.",
    images: ["/images/gallery/royal-stage.jpg"],
  },
};

export default function GalleryPage() {
  return <GalleryPageClient />;
}
