// PLACEHOLDER — editable event/occasion catalog. Set `enabled: false` to hide
// a category without deleting it. Descriptions are intentionally general
// until the client confirms specific package details, decor, or services.

export interface EventCategory {
  slug: string;
  title: string;
  urduLabel?: string;
  description: string;
  enabled: boolean;
}

export const eventCategories: EventCategory[] = [
  {
    slug: "weddings",
    title: "Weddings",
    urduLabel: "شادی مبارک",
    description:
      "A spacious indoor setting with dedicated table service for your wedding day, sized for family and friends.",
    enabled: true,
  },
  {
    slug: "mehndi",
    title: "Mehndi",
    urduLabel: "مہندی تقریب",
    description:
      "A casual, comfortable atmosphere for pre-wedding celebrations with family and close guests.",
    enabled: true,
  },
  {
    slug: "barat",
    title: "Barat",
    urduLabel: "بارات",
    description:
      "Room to host the groom's party and extended family, with parking for arriving guests.",
    enabled: true,
  },
  {
    slug: "walima",
    title: "Walima",
    urduLabel: "ولیمہ",
    description:
      "Lunch or dinner seating with attentive table service for your reception.",
    enabled: true,
  },
  {
    slug: "engagement",
    title: "Engagements",
    urduLabel: "منگنی",
    description:
      "An intimate setting suited to smaller family gatherings and engagement ceremonies.",
    enabled: true,
  },
  {
    slug: "family",
    title: "Family Celebrations",
    urduLabel: "خاندانی تقریب",
    description:
      "A comfortable, family-friendly venue for birthdays, reunions, and other group occasions.",
    enabled: true,
  },
];
