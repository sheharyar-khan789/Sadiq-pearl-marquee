// Menus transcribed from the venue's own printed menu card (supplied photos).
// The printed card lists NO prices ("Rs. P/h" is blank), so none are shown.
// Every wedding menu also includes: Roghni Naan, Green Salad, Raita,
// Soft Drink and Mineral Water — kept in each list, exactly as printed.

export interface MenuSet {
  id: string;
  title: string;
  items: string[];
  sheet?: number; // which printed sheet (1–3) shows this menu
}

const wedding = (main: string, rice: string, sweet = "Kheer / Trifle"): string[] => [
  main, rice, "Roghni Naan", "Green Salad", "Raita", sweet, "Soft Drink", "Mineral Water",
];

export const weddingMenus: MenuSet[] = [
  { id: "w1", title: "Wedding Menu 1", sheet: 3, items: wedding("Chicken Qorma", "Chicken Pulao", "Trifle / Kheer") },
  { id: "w2", title: "Wedding Menu 2", sheet: 1, items: wedding("Chicken Achar Gosht", "Chicken Biryani") },
  { id: "w3", title: "Wedding Menu 3", sheet: 1, items: wedding("Chicken Handi", "Chicken Vegi Pulao") },
  { id: "w4", title: "Wedding Menu 4", sheet: 1, items: wedding("Mutton Qorma", "Chicken Biryani") },
  { id: "w5", title: "Wedding Menu 5", sheet: 2, items: wedding("Mutton White Qorma", "Chicken Pulao") },
  { id: "w6", title: "Wedding Menu 6", sheet: 2, items: wedding("Beef Qorma", "Chicken Biryani", "Kheer / Halwa Gajar") },
  { id: "w7", title: "Wedding Menu 7", sheet: 2, items: wedding("Beef White Karahi", "Chicken Pulao") },
];

export const mehndiMenus: MenuSet[] = [
  {
    id: "m1", title: "Mehndi Menu 1", sheet: 3,
    items: ["Halwa Puri", "Chicken Chanay", "Roghni Naan", "Fresh Salad", "Raita", "Kashmiri Tea", "Chicken Tikka", "Chicken Kebab"],
  },
  {
    id: "m2", title: "Mehndi Menu 2", sheet: 3,
    items: ["Gol Gappy", "Chana Chaat", "Halwa Puri", "Chicken Tikka Boti", "Chicken Kebab", "Chicken Karahi", "Roghni Naan", "Fresh Salad", "Mint Raita"],
  },
];

export const sweetsAndSides: MenuSet[] = [
  { id: "desserts", title: "Desserts", items: ["Gajir Halwa", "Pettha Halwa", "Chakwali Halwa", "Qulfa Falooda", "Ice Cream", "Firni / Zarda / Matanjan"] },
  { id: "salads", title: "Salads", items: ["Russian Salad", "Red Bean Salad", "Chana Salad", "Macaroni Salad"] },
  { id: "drinks", title: "Juices & Tea", items: ["Nestle Juices", "Fresh Juice (seasonal)", "Green Tea", "Kashmiri Tea", "Mint Margaretta"] },
];

// The three printed sheets shown in the "menu card" viewer.
export const menuSheets = [
  { src: "/menu/sheet-1.jpg", title: "Wedding Menus 2 – 4" },
  { src: "/menu/sheet-2.jpg", title: "Wedding Menus 5 – 7" },
  { src: "/menu/sheet-3.jpg", title: "Mehndi Menus 1 – 2 & Wedding Menu 1" },
];
export const menuPdf = "/menu/sadiq-pearl-marquee-menu-card.pdf";

// Terms & conditions ("شرائط و ضوابط") as printed on the card, translated from Urdu.
export const terms: { title: string; body: string }[] = [
  { title: "Minimum guests", body: "All services are for a minimum of 300 guests. For fewer guests, an extra Rs. 300 per head is charged." },
  { title: "Outside catering & decoration", body: "Catering or decoration from outside is strictly not allowed." },
  { title: "Your belongings", body: "During the function and when leaving the hall, you are responsible for keeping your valuables safe." },
  { title: "AC charges", body: "AC charges are Rs. 20,000 for one hour." },
  { title: "Fireworks & firing", body: "Fireworks and firing are strictly prohibited. The person who books the hall is fully responsible for any violation." },
  { title: "Service charges & extra time", body: "5% service charges apply. Extra time is charged at Rs. 20,000 per hour." },
  { title: "Extra services", body: "Extra decoration, extra lighting, sound system and other extra services are charged separately." },
  { title: "Taxes & advance", body: "All government taxes and regulations apply to the customer. The advance amount is non-refundable." },
];
