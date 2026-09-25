# Sadiq Pearl Marquee — Website

Production-ready Next.js 14 (App Router + TypeScript + Tailwind CSS) website
for Sadiq Pearl Marquee.

## Running it

Requires Node.js 18.18+ (tested on Node 22).

```bash
npm install
npm run dev       # http://localhost:3000
```

To build and run the production build:

```bash
npm run build
npm run start
```

## Where to edit things

| What to change | File |
|---|---|
| Phones, address, email, rating, WhatsApp number, social, Maps link, form options | `src/lib/config.ts` |
| Menus, terms & conditions, menu-card sheets and PDF | `src/data/menu.ts`, `public/menu/` |
| Event cards / highlights / reviews | `src/data/events.ts`, `highlights.ts`, `reviews.ts` |
| Gallery photos and video clips | `src/data/gallery.ts`, `public/images/`, `public/videos/` |
| Colors and fonts (Stitch redesign: ivory + antique gold, Playfair Display + Plus Jakarta Sans) | `tailwind.config.ts`, `src/app/layout.tsx` |
| Logo | `public/images/logo.jpg` |

## Content status

- **CONFIRMED:** name, address, the 3 phone numbers (all on WhatsApp; inquiries go to 0345 5673921), email and TikTok from the printed card, Google rating 4.4 (8 reviews), the 3 real reviews, the menus and terms transcribed from the printed menu card.
- **Not published because unconfirmed:** prices (the card has none), guest capacity, session timings, opening hours.
- **Open question:** the printed card shows different phone numbers and the address "Nothia Road, Tabbi Tawan". The site uses the Google Business Profile details above until the client confirms which is current.
- The booking form only opens WhatsApp with a pre-filled message. Nothing is booked until the venue replies.
