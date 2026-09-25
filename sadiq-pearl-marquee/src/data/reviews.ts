// CONFIRMED — verbatim from the Sadiq Pearl Marquee Google Business Profile
// (captured 2026). Do not add reviews here unless they are real and supplied
// by the client — see /docs or ask before inventing testimonials.

export interface Review {
  author: string;
  rating: number; // out of 5
  text: string;
  context?: string; // e.g. what the reviewer selected (dining type)
}

export const reviews: Review[] = [
  {
    author: "Abdul Mateen",
    rating: 5,
    text: "Very Excellent Environment",
    context: "Lunch",
  },
  {
    author: "Haroon Gujjar",
    rating: 4,
    text: "Every thing is good",
  },
  {
    author: "Malik Asad",
    rating: 3,
    text: "Average",
    context: "Dine-in",
  },
];

// CONFIRMED — Google's own "Know before you go" summary for this listing.
// Shown as a Google-attributed highlight, not as an individual testimonial.
export const googleHighlights = [
  "Visitors say the staff and environment are great and affordable.",
  "People highlight the stunning lobby and iconic building design.",
];
