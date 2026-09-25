// Verified Sadiq Pearl Marquee Gallery & Video Data
// Every entry references an actual media asset in /public.
// No stock or fabricated imagery.

export type GalleryCategory = "all" | "interior" | "decoration" | "exterior" | "dining";

export interface GalleryItem {
  id: string;
  category: "interior" | "decoration" | "exterior" | "dining";
  title: string;
  caption: string;
  image: string;
  aspect?: "portrait" | "landscape" | "square" | "wide";
  featured?: boolean;
}

export const galleryCategories: { key: GalleryCategory; label: string }[] = [
  { key: "all", label: "All Highlights" },
  { key: "interior", label: "Halls & Aisles" },
  { key: "decoration", label: "Stages & Florals" },
  { key: "exterior", label: "Exterior & Grounds" },
  { key: "dining", label: "Dining & Desserts" },
];

export const galleryItems: GalleryItem[] = [
  // FEATURED / HIGHLIGHTS
  {
    id: "royal-stage",
    category: "decoration",
    title: "Royal Wedding Stage",
    caption: "Carved gold sofas, layered floral canopy, and patterned stage floor.",
    image: "/images/gallery/royal-stage.jpg",
    aspect: "landscape",
    featured: true,
  },
  {
    id: "crystal-hall",
    category: "interior",
    title: "Crystal Chandelier Hall",
    caption: "Tiered crystal strands and ambient lighting over guest tables.",
    image: "/images/gallery/crystal-hall.jpg",
    aspect: "portrait",
    featured: true,
  },
  {
    id: "entrance-arch",
    category: "decoration",
    title: "Floral Entrance Arch",
    caption: "Sculpted white floral arch greeting arriving guests at the main doorway.",
    image: "/images/gallery/entrance-arch.jpg",
    aspect: "portrait",
    featured: true,
  },
  {
    id: "exterior-fireworks",
    category: "exterior",
    title: "Celebration Fireworks",
    caption: "Evening fireworks display over Sadiq Pearl Marquee on Rashidpur–Orangabad Road.",
    image: "/images/exterior/exterior-aerial-fireworks.jpg",
    aspect: "wide",
    featured: true,
  },

  // INTERIOR & AISLES
  {
    id: "interior-banquet",
    category: "interior",
    title: "Grand Banquet Hall",
    caption: "Expansive hall seating arranged with table service dining.",
    image: "/images/interior/interior-banquet-full.jpg",
    aspect: "landscape",
  },
  {
    id: "chandelier-hall",
    category: "interior",
    title: "Illuminated Hall & Ceiling",
    caption: "Overhead chandeliers and stage illumination across the central hall.",
    image: "/images/gallery/chandelier-hall.jpg",
    aspect: "landscape",
  },
  {
    id: "floral-aisle",
    category: "interior",
    title: "Floral Aisle Walkway",
    caption: "Lattice arches with lush hanging greenery leading toward the stage.",
    image: "/images/gallery/floral-aisle.jpg",
    aspect: "portrait",
  },
  {
    id: "interior-aisle",
    category: "interior",
    title: "Central Carpeted Aisle",
    caption: "Wide central procession aisle framed by table arrangements.",
    image: "/images/interior/interior-aisle.jpg",
    aspect: "portrait",
  },
  {
    id: "interior-chandelier",
    category: "interior",
    title: "Grand Reception Lobby",
    caption: "Polished marble lobby with gilded ceiling chandeliers.",
    image: "/images/interior/interior-chandelier-lobby.jpg",
    aspect: "landscape",
  },
  {
    id: "interior-vip",
    category: "interior",
    title: "VIP Lounge Seating",
    caption: "Dedicated comfortable sofa seating for family elders and close guests.",
    image: "/images/interior/interior-vip-lounge.jpg",
    aspect: "landscape",
  },
  {
    id: "interior-backdrop",
    category: "interior",
    title: "Custom Event Backdrop",
    caption: "Floor-set backdrop arrangement for photography and celebrations.",
    image: "/images/interior/interior-backdrop-floor.jpg",
    aspect: "square",
  },

  // DECORATION & STAGES
  {
    id: "chandelier-arch",
    category: "decoration",
    title: "Floral Arch & Chandeliers",
    caption: "Delicate floral arches placed beneath gleaming crystal pendants.",
    image: "/images/gallery/chandelier-arch.jpg",
    aspect: "portrait",
  },
  {
    id: "entrance-lobby",
    category: "decoration",
    title: "Lobby Floral Reception",
    caption: "Floral welcome arrangements and lattice console tables.",
    image: "/images/gallery/entrance-lobby.jpg",
    aspect: "portrait",
  },
  {
    id: "decoration-stage",
    category: "decoration",
    title: "Celebration Stage Arch",
    caption: "Fresh floral arrangement for intimate stage backdrops.",
    image: "/images/events/event-stage-arch.jpg",
    aspect: "landscape",
  },
  {
    id: "decoration-peacock",
    category: "decoration",
    title: "Peacock Floral Art Piece",
    caption: "Artisan sculpted floral peacock centerpiece at the entrance.",
    image: "/images/decoration/decoration-peacock.jpg",
    aspect: "portrait",
  },
  {
    id: "decoration-ceiling",
    category: "decoration",
    title: "Chandelier & Ceiling Detail",
    caption: "Intricate gilded craftsmanship and warm ambient lighting.",
    image: "/images/decoration/decoration-chandelier-detail.jpg",
    aspect: "portrait",
  },

  // EXTERIOR & GROUNDS
  {
    id: "exterior-night-facade",
    category: "exterior",
    title: "Night Facade Illumination",
    caption: "Architectural lighting illuminating the exterior frontage in Kakrot.",
    image: "/images/hero/hero-primary.jpg",
    aspect: "landscape",
  },
  {
    id: "exterior-daytime",
    category: "exterior",
    title: "Daytime Frontage & Parking",
    caption: "Direct road access with free parking lot and street parking on Rashidpur–Orangabad Road.",
    image: "/images/exterior/exterior-daytime-facade.jpg",
    aspect: "landscape",
  },
  {
    id: "exterior-colonnade",
    category: "exterior",
    title: "Colonnade Architecture",
    caption: "Classic portico colonnade and grand entrance portico.",
    image: "/images/exterior/exterior-colonnade.jpg",
    aspect: "landscape",
  },

  // DINING & DESSERTS
  {
    id: "dessert-buffet",
    category: "dining",
    title: "Traditional Dessert Buffet",
    caption: "Tiered counters with traditional Pakistani sweets and desserts.",
    image: "/images/gallery/dessert-buffet.jpg",
    aspect: "landscape",
  },
  {
    id: "dessert-counter",
    category: "dining",
    title: "Dessert Presentation Counter",
    caption: "Gold-trimmed buffet counter presenting confections and fresh fruits.",
    image: "/images/gallery/dessert-counter.jpg",
    aspect: "landscape",
  },
  {
    id: "dining-biryani",
    category: "dining",
    title: "Special Wedding Biryani",
    caption: "Aromatic basmati rice prepared fresh for banquet table service.",
    image: "/images/dining/dining-biryani.jpg",
    aspect: "square",
  },
  {
    id: "dining-karahi",
    category: "dining",
    title: "Signature Karahi Course",
    caption: "Rich Pakistani meat course served warm to each guest table.",
    image: "/images/dining/dining-karahi.jpg",
    aspect: "square",
  },
  {
    id: "dining-kheer",
    category: "dining",
    title: "Traditional Kheer Dessert",
    caption: "Slow-cooked rice pudding served chilled in traditional bowls.",
    image: "/images/dining/dining-kheer.jpg",
    aspect: "square",
  },
  {
    id: "dining-dessert-display",
    category: "dining",
    title: "Assorted Dessert Display",
    caption: "Gourmet sweet selection arranged alongside banquet dining.",
    image: "/images/dining/dining-dessert-display.jpg",
    aspect: "landscape",
  },
  {
    id: "dining-dessert-counter",
    category: "dining",
    title: "Buffet Spread & Sweet Course",
    caption: "Freshly staged dessert and pastry service for wedding receptions.",
    image: "/images/dining/dining-dessert-counter.jpg",
    aspect: "landscape",
  },
];

export interface VideoItem {
  id: string;
  title: string;
  subtitle: string;
  caption: string;
  src: string;
  poster: string;
  duration?: string;
  featured?: boolean;
}

export const videos: VideoItem[] = [
  {
    id: "entrance-tour",
    title: "Grand Entrance Walkthrough",
    subtitle: "Front Entrance & Foyer",
    caption:
      "Experience walking through the illuminated entrance colonnade and into the grand chandelier foyer.",
    src: "/videos/entrance-tour.mp4",
    poster: "/videos/entrance-tour-poster.jpg",
    duration: "Tour",
    featured: true,
  },
  {
    id: "aerial-view",
    title: "Aerial Grounds & Frontage",
    subtitle: "Drone Perspective",
    caption:
      "High-angle view of the marquee architecture, wide road frontage, and guest parking facilities in Kakrot.",
    src: "/videos/exterior-aerial.mp4",
    poster: "/videos/exterior-aerial-poster.jpg",
    duration: "Aerial",
  },
  {
    id: "night-facade",
    title: "Evening Facade Illumination",
    subtitle: "Night Ambiance",
    caption:
      "A scenic exterior capture showing the marquee glowing against the evening sky on Rashidpur–Orangabad Road.",
    src: "/videos/hero-exterior.mp4",
    poster: "/images/hero/hero-primary.jpg",
    duration: "Night",
  },
];
