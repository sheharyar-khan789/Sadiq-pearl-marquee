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

// Terms & conditions ("شرائط و ضوابط"): the official venue terms live in ./policies.ts
// (single source); re-exported here for the existing menu / terms components.
export { OFFICIAL_VENUE_TERMS as terms } from "./policies.ts";
