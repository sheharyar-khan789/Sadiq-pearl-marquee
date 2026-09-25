// CONFIRMED — grounded in the Google Business Profile feature list
// (see src/lib/config.ts -> venueFeatures). Descriptions stay generic where
// the client hasn't confirmed specifics.

export interface Highlight {
  number: string;
  title: string;
  description: string;
}

export const highlights: Highlight[] = [
  {
    number: "01",
    title: "Table Service Dining",
    description:
      "Lunch and dinner service with staff attending each table, suited to both small plates and full gatherings.",
  },
  {
    number: "02",
    title: "Built for Groups & Families",
    description:
      "A casual atmosphere that's comfortable for large groups and good for kids, ideal for multi-generation family events.",
  },
  {
    number: "03",
    title: "Free Parking, On-Site & Street",
    description:
      "A dedicated parking lot plus free street parking along the marquee frontage for arriving guests.",
  },
  {
    number: "04",
    title: "Architectural Presence",
    description:
      "A landmark facade on Rashidpur–Orangabad Road, illuminated in the evenings for arriving guests.",
  },
];
