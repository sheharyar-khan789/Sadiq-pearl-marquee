// Verified Sadiq Pearl Marquee gallery & video data.
// Every entry references a real media asset in /public — no stock imagery.
// width/height are the files' actual pixel dimensions (measured), so the
// gallery can show each photo at its true ratio without cropping or layout shift.

export type GalleryCategory = "all" | "interior" | "decoration" | "exterior" | "dining";

export interface GalleryItem {
  id: string;
  category: Exclude<GalleryCategory, "all">;
  title: string;
  caption: string;
  image: string;
  width: number;
  height: number;
  /** Shown in the curated home-page selection. */
  featured?: boolean;
}

export const galleryCategories: { key: GalleryCategory; label: string }[] = [
  { key: "all", label: "All" },
  { key: "interior", label: "Halls & Aisles" },
  { key: "decoration", label: "Stages & Florals" },
  { key: "exterior", label: "Exterior" },
  { key: "dining", label: "Dining" },
];

export const categoryLabel: Record<GalleryItem["category"], string> = {
  interior: "Halls & Aisles",
  decoration: "Stages & Florals",
  exterior: "Exterior",
  dining: "Dining",
};

export const galleryItems: GalleryItem[] = [
  // STAGES & FLORALS
  {
    id: "royal-stage",
    category: "decoration",
    title: "Royal Wedding Stage",
    caption: "Carved gold sofas, layered floral canopy, and patterned stage floor.",
    image: "/images/gallery/royal-stage.jpg",
    width: 1200,
    height: 1600,
    featured: true,
  },
  {
    id: "stage-rose-arch",
    category: "decoration",
    title: "Rose Frame Stage",
    caption: "Red and white rose frame over gold sofas, beneath the carved gold ceiling.",
    image: "/videos/stage-rose-arch-poster.jpg",
    width: 720,
    height: 1280,
    featured: true,
  },
  {
    id: "stage-blue-arch",
    category: "decoration",
    title: "Illuminated Arch Stage",
    caption: "Lit arch backdrop with white floral arches and a mosaic floor.",
    image: "/videos/stage-blue-arch-poster.jpg",
    width: 720,
    height: 1280,
  },
  {
    id: "entrance-arch",
    category: "decoration",
    title: "Floral Entrance Arch",
    caption: "Sculpted white floral arch greeting arriving guests at the main doorway.",
    image: "/images/gallery/entrance-arch.jpg",
    width: 1200,
    height: 1600,
    featured: true,
  },
  {
    id: "chandelier-arch",
    category: "decoration",
    title: "Floral Arch & Chandeliers",
    caption: "Delicate floral arches placed beneath gleaming crystal pendants.",
    image: "/images/gallery/chandelier-arch.jpg",
    width: 1200,
    height: 1600,
  },
  {
    id: "entrance-lobby",
    category: "decoration",
    title: "Lobby Floral Reception",
    caption: "Floral welcome arrangements and lattice console tables.",
    image: "/images/gallery/entrance-lobby.jpg",
    width: 1200,
    height: 1600,
  },
  {
    id: "decoration-stage",
    category: "decoration",
    title: "Draped Ceiling Décor",
    caption: "Draped fabric ceiling and floral stands along the hall.",
    image: "/images/events/event-stage-arch.jpg",
    width: 576,
    height: 1024,
  },
  {
    id: "decoration-peacock",
    category: "decoration",
    title: "Aisle to the Floral Stage",
    caption: "Crystal chandeliers above a marble aisle leading to an arched floral stage.",
    image: "/images/decoration/decoration-peacock.jpg",
    width: 900,
    height: 1600,
    featured: true,
  },
  {
    id: "decoration-ceiling",
    category: "decoration",
    title: "Chandelier & Ceiling Detail",
    caption: "Intricate gilded craftsmanship and warm ambient lighting.",
    image: "/images/decoration/decoration-chandelier-detail.jpg",
    width: 576,
    height: 1024,
  },

  // HALLS & AISLES
  {
    id: "crystal-hall",
    category: "interior",
    title: "Crystal Chandelier Hall",
    caption: "Tiered crystal strands and ambient lighting over guest tables.",
    image: "/images/gallery/crystal-hall.jpg",
    width: 1200,
    height: 1600,
    featured: true,
  },
  {
    id: "interior-banquet",
    category: "interior",
    title: "Grand Banquet Hall",
    caption: "Expansive hall seating arranged with table service dining.",
    image: "/images/interior/interior-banquet-full.jpg",
    width: 1024,
    height: 576,
    featured: true,
  },
  {
    id: "chandelier-hall",
    category: "interior",
    title: "Illuminated Hall & Ceiling",
    caption: "Overhead chandeliers and stage illumination across the central hall.",
    image: "/images/gallery/chandelier-hall.jpg",
    width: 1200,
    height: 1600,
  },
  {
    id: "floral-aisle",
    category: "interior",
    title: "Floral Aisle Walkway",
    caption: "Lattice arches with lush hanging greenery leading toward the stage.",
    image: "/images/gallery/floral-aisle.jpg",
    width: 1200,
    height: 1600,
    featured: true,
  },
  {
    id: "interior-aisle",
    category: "interior",
    title: "Central Carpeted Aisle",
    caption: "Wide central procession aisle framed by table arrangements.",
    image: "/images/interior/interior-aisle.jpg",
    width: 576,
    height: 1024,
  },
  {
    id: "interior-vip",
    category: "interior",
    title: "VIP Lounge Seating",
    caption: "Dedicated comfortable sofa seating for family elders and close guests.",
    image: "/images/interior/interior-vip-lounge.jpg",
    width: 576,
    height: 1024,
  },
  {
    id: "interior-backdrop",
    category: "interior",
    title: "Banquet Seating",
    caption: "Guest tables and chairs arranged across the marble hall floor.",
    image: "/images/interior/interior-backdrop-floor.jpg",
    width: 576,
    height: 1024,
  },

  // EXTERIOR
  {
    id: "exterior-night-facade",
    category: "exterior",
    title: "Night Facade Illumination",
    caption: "Architectural lighting illuminating the exterior frontage in Kakrot.",
    image: "/images/hero/hero-primary.jpg",
    width: 1024,
    height: 576,
    featured: true,
  },
  {
    id: "exterior-fireworks",
    category: "exterior",
    title: "Evening Celebration",
    caption: "Aerial evening view over Sadiq Pearl Marquee on Rashidpur–Orangabad Road.",
    image: "/images/exterior/exterior-aerial-fireworks.jpg",
    width: 1024,
    height: 576,
  },
  {
    id: "exterior-daytime",
    category: "exterior",
    title: "Entrance Portico",
    caption: "Columned entrance portico beneath the Sadiq Pearl signage, in daylight.",
    image: "/images/exterior/exterior-daytime-facade.jpg",
    width: 900,
    height: 1600,
  },
  {
    id: "exterior-colonnade",
    category: "interior",
    title: "Grand Foyer",
    caption: "Crystal chandeliers and a marble floor at the doorway into the hall.",
    image: "/images/exterior/exterior-colonnade.jpg",
    width: 900,
    height: 1600,
  },

  // DINING
  {
    id: "dessert-buffet",
    category: "dining",
    title: "Traditional Dessert Buffet",
    caption: "Tiered counters with traditional Pakistani sweets and desserts.",
    image: "/images/gallery/dessert-buffet.jpg",
    width: 1200,
    height: 1600,
    featured: true,
  },
  {
    id: "dessert-counter",
    category: "dining",
    title: "Dessert Presentation Counter",
    caption: "Gold-trimmed buffet counter presenting confections and fresh fruits.",
    image: "/images/gallery/dessert-counter.jpg",
    width: 1200,
    height: 1600,
  },
  {
    id: "dining-biryani",
    category: "dining",
    title: "Biryani",
    caption: "Aromatic basmati rice prepared for banquet table service.",
    image: "/images/dining/dining-biryani.jpg",
    width: 900,
    height: 1600,
  },
  {
    id: "dining-karahi",
    category: "dining",
    title: "Karahi",
    caption: "Rich Pakistani meat course served warm to each guest table.",
    image: "/images/dining/dining-karahi.jpg",
    width: 900,
    height: 1600,
  },
  {
    id: "dining-kheer",
    category: "dining",
    title: "Kheer",
    caption: "Slow-cooked rice pudding served in traditional bowls.",
    image: "/images/dining/dining-kheer.jpg",
    width: 900,
    height: 1600,
  },
  {
    id: "dining-dessert-display",
    category: "dining",
    title: "Assorted Dessert Display",
    caption: "Sweet selection arranged alongside banquet dining.",
    image: "/images/dining/dining-dessert-display.jpg",
    width: 900,
    height: 1600,
  },
  {
    id: "dining-dessert-counter",
    category: "dining",
    title: "Buffet Spread & Sweet Course",
    caption: "Dessert and pastry service for wedding receptions.",
    image: "/images/dining/dining-dessert-counter.jpg",
    width: 900,
    height: 1600,
  },
  // Kept last: this source image is a camera-app screenshot with on-screen
  // camera readouts. Replace with a clean photo when one is supplied.
  {
    id: "interior-chandelier",
    category: "interior",
    title: "Grand Reception Lobby",
    caption: "Polished marble lobby with gilded ceiling chandeliers.",
    image: "/images/interior/interior-chandelier-lobby.jpg",
    width: 900,
    height: 1600,
  },
];

export interface VideoItem {
  id: string;
  title: string;
  caption: string;
  src: string;
  poster: string;
  width: number;
  height: number;
}

// Portrait (9:16) films shown as "reels" in the Stages & Décor section.
export const reels: VideoItem[] = [
  {
    id: "stage-rose-arch",
    title: "Rose Frame Stage",
    caption: "Red and white roses, gold sofas and the carved gold ceiling.",
    src: "/videos/stage-rose-arch.mp4",
    poster: "/videos/stage-rose-arch-poster.jpg",
    width: 720,
    height: 1280,
  },
  {
    id: "stage-blue-arch",
    title: "Illuminated Arch Stage",
    caption: "A lit arch backdrop framed by white floral arches.",
    src: "/videos/stage-blue-arch.mp4",
    poster: "/videos/stage-blue-arch-poster.jpg",
    width: 540,
    height: 960,
  },
  {
    id: "entrance-tour",
    title: "Entrance Walkthrough",
    caption: "Through the illuminated colonnade into the chandelier foyer.",
    src: "/videos/entrance-tour.mp4",
    poster: "/videos/entrance-tour-poster.jpg",
    width: 608,
    height: 1080,
  },
  {
    id: "stage-red-frame",
    title: "Red Rose Stage",
    caption: "Red rose columns against a white drape backdrop.",
    src: "/videos/stage-red-frame.mp4",
    poster: "/videos/stage-red-frame-poster.jpg",
    width: 540,
    height: 960,
  },
];
