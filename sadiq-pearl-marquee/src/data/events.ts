// PLACEHOLDER — editable event/occasion catalog. Set `enabled: false` to hide
// a category without deleting it. Descriptions are intentionally general
// until the client confirms specific package details, decor, or services.

export interface EventCategory {
  slug: string;
  title: string;
  urduLabel?: string;
  description: string;
  image: string;
  imageAlt: string;
  enabled: boolean;
}

export const eventCategories: EventCategory[] = [
  {
    slug: "weddings",
    title: "Weddings",
    urduLabel: "شادی",
    description:
      "A spacious indoor setting with dedicated table service for your wedding day, sized for family and friends.",
    image: "/images/gallery/royal-stage.jpg",
    imageAlt: "Decorated wedding stage with gold seating and a floral canopy",
    enabled: true,
  },
  {
    slug: "mehndi",
    title: "Mehndi",
    urduLabel: "مہندی",
    description:
      "A casual, comfortable atmosphere for pre-wedding celebrations with family and close guests.",
    image: "/images/gallery/chandelier-arch.jpg",
    imageAlt: "Floral arch beneath crystal chandeliers",
    enabled: true,
  },
  {
    slug: "barat",
    title: "Barat",
    urduLabel: "بارات",
    description:
      "Room to host the groom's party and extended family, with parking for arriving guests.",
    image: "/images/gallery/entrance-arch.jpg",
    imageAlt: "Floral entrance arch for arriving guests",
    enabled: true,
  },
  {
    slug: "walima",
    title: "Walima",
    urduLabel: "ولیمہ",
    description:
      "Lunch or dinner seating with attentive table service for your reception.",
    image: "/images/interior/interior-banquet-full.jpg",
    imageAlt: "Banquet hall arranged with table service",
    enabled: true,
  },
  {
    slug: "engagement",
    title: "Engagements",
    urduLabel: "منگنی",
    description:
      "An intimate setting suited to smaller family gatherings and engagement ceremonies.",
    image: "/images/events/event-stage-arch.jpg",
    imageAlt: "Hall decorated with a draped fabric ceiling and floral stands",
    enabled: true,
  },
  {
    slug: "family",
    title: "Family Celebrations",
    urduLabel: "خاندانی تقریب",
    description:
      "A comfortable, family-friendly venue for birthdays, reunions, and other group occasions.",
    image: "/images/interior/interior-vip-lounge.jpg",
    imageAlt: "Lounge seating for family gatherings",
    enabled: true,
  },
];
