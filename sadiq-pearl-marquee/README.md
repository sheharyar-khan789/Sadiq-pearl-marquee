# Sadiq Pearl Marquee — Website

Next.js 16 (App Router + React 19 + TypeScript + Tailwind CSS) website
for Sadiq Pearl Marquee.

## Running it

Requires Node.js 20.9+ (tested on Node 24).

```bash
npm install
npm run dev       # http://localhost:3000
```

To build and run the production build:

```bash
npm run build
npm run start
```

Quality checks:

```bash
npm run typecheck
npm run lint
```

## Where to edit things

| What to change | File |
|---|---|
| Phones, address, rating, WhatsApp number, social, Maps link, form options, **site domain** (`siteUrl`) | `src/lib/config.ts` |
| Menus, terms & conditions, menu-card sheets and PDF | `src/data/menu.ts`, `public/menu/` |
| Event cards (text, Urdu label, photo) / amenities / reviews | `src/data/events.ts`, `highlights.ts`, `reviews.ts` |
| Gallery photos (with real pixel width/height) and the stage/venue reels | `src/data/gallery.ts`, `public/images/`, `public/videos/` |
| Hero film and posters | `media` in `src/lib/config.ts`, `public/videos/` |
| Colours, spacing, shadows (ivory, espresso, champagne-gold tokens) | `tailwind.config.ts`, `src/app/globals.css` |
| Fonts (Cormorant Garamond + Plus Jakarta Sans, self-hosted via `next/font`) | `src/app/layout.tsx` |
| Header, footer, overlays and structured data shared by public pages | `src/app/(site)/layout.tsx` |
| Logo | `public/images/logo.jpg` |

## Customer accounts (Firebase)

Sign-in, sign-up (email/password and Google), email verification and `/account` use Firebase
Authentication, with a server-verified httpOnly session cookie. Setup: copy `.env.example` to
`.env.local` and fill it in (see `SADIQ_PEARL_PHASE_2_REPORT.md` → "Manual Firebase Console steps").
Without that configuration the site still builds and runs; the sign-in pages show a WhatsApp contact
message instead of the forms.

| What | Where |
|---|---|
| Firestore / Storage security rules | `firestore.rules`, `storage.rules` (deploy with `firebase deploy --only firestore:rules,storage`) |
| Rules tests (Firebase CLI + Java 21 required) | `npm run test:rules` |
| Grant / revoke the Super Admin role | `node --env-file=.env.local scripts/set-super-admin.mjs <email> [--revoke]` |

## Booking requests & availability (Phase 3)

`/book` shows free dates and Day / Night slots and lets a signed-in customer (verified email) send a
booking request. The server enforces one active booking per date + hall + slot inside a Firestore
transaction (`slotLocks/{date__hall__slot}`); see `SADIQ_PEARL_PHASE_3_REPORT.md`.

| What | Where |
|---|---|
| Hall, slots (times), event types, services, menus, packages (defaults; edit in `/admin/settings`) | `src/lib/config/business-config.ts` |
| Pending-hold hours, open-request limit, booking window, same-day rule | `/admin/settings` → Booking rules |
| Prices and advance (none configured yet; nothing is priced until they are) | `/admin/settings` → Pricing; engine in `src/lib/booking/pricing.ts` |
| Business time zone | `src/lib/booking/dates.ts` |
| Booking engine (create, status changes, availability) | `src/lib/booking/engine.ts` |
| Firestore indexes (deploy with `firebase deploy --only firestore:indexes`) | `firestore.indexes.json` |
| Engine tests (no emulator needed) | `npm run test:booking` |
| Engine tests on the Firestore emulator (Firebase CLI + Java 21) | `npm run test:booking:firestore` |

## Customer portal (Phase 4)

Signed-in customers get `/account` (dashboard), `/account/bookings` (list + filters),
`/account/bookings/[id]` (details, pricing, status timeline, change / cancellation **requests**) and
`/account/profile` (name, phone, Firebase-verified email change). All data is read on the server,
scoped to the session uid; requests are stored in `bookingRequests` and never change a booking.
See `SADIQ_PEARL_PHASE_4_REPORT.md`.

## Super Admin panel (Phase 5)

`/admin` (dashboard, bookings, booking review, new booking, calendar, customers) is available only to
accounts with the server-set `role: super_admin` claim and a verified email
(`node --env-file=.env.local scripts/set-super-admin.mjs <email>`). Every admin page and API verifies this on
the server; all changes run through the booking engine's transactions and are recorded in `adminAudit`.
See `SADIQ_PEARL_PHASE_5_REPORT.md`.

## Business configuration (Phase 6)

Hall name and capacity, Day/Night slot times, booking rules, event types, services, menus (with items),
packages, prices, advance and policies are managed by the Super Admin at `/admin/settings` and stored in
one versioned Firestore document (`businessConfig/main`). The booking engine, `/book`, staff bookings and
change approvals all read it; existing bookings keep their stored snapshots. Until something is saved, the
built-in defaults (`src/lib/config/business-config.ts`) reproduce the earlier behaviour, and nothing is
priced. See `SADIQ_PEARL_PHASE_6_REPORT.md`.

## Payments, quotations & receipts (Phase 7)

On a booking's admin page (`/admin/bookings/{id}` → "Payments & quotations") the Super Admin records
manual/offline payments (cash, bank transfer, cheque, other), voids a wrong entry with a reason (never
deleted), drafts and issues quotations, and downloads PDFs. Every change runs in one Firestore transaction
with its audit record; the balance is re-checked inside the transaction, so two admins can't overpay.
Quotations (`SPQ-YYYY-NNNNNN`) copy the booking's stored price and are never changed once issued; each
payment carries its own receipt snapshot (`SPR-YYYY-NNNNNN`). Customers see their issued quotations,
payment history and receipt PDFs in `/account/bookings/{id}` (read-only). Collections `payments`,
`quotations` and `counters` are server-only in `firestore.rules`. See `SADIQ_PEARL_PHASE_7_REPORT.md`.

## Event operations & calendar (Phase 8)

- `/admin/events` lists upcoming confirmed events (today / tomorrow / 7 / 30 days / date range, slot,
  operational status, booking status, search).
- `/admin/events/{bookingId}` is the event sheet: event, customer, read-only payment summary, selections,
  operational status (Not started → Preparing → Ready → In progress → Completed), a preparation checklist
  generated from what the booking actually includes, vendor assignments and internal notes.
- `/admin/vendors` holds the vendors the admin enters; none are pre-filled.
- `/admin/calendar` now has Month, Week and Day views of the same booking data.
- Operational data lives in `eventOperations/{bookingId}`, `vendors` and `vendorAssignments`. All three are
  server-only and audited, and they never change bookings, payments, quotations or receipts.
- See `SADIQ_PEARL_PHASE_8_REPORT.md`.

## Notifications & communication (Phase 9)

- **In-app notifications:** when a booking, change request, quotation or payment changes, the customer gets an in-app notification (`notifications/{id}`). It is written in the same transaction as the change, so it exists exactly once.
- **Customer view:** customers see their notifications at `/account/notifications`, with an unread badge, mark one or all as read, and pagination.
- **Manual WhatsApp:** staff open prepared WhatsApp messages from the admin booking page and the event sheet (for vendors).
  - The server builds the text from real records and records it as "initiated" (`communications/{id}`, audited). It does not claim the message was sent or delivered.
- **Communication center:** `/admin/communications` lists both kinds of record.
- **Not configured:** automated WhatsApp, email and SMS (no provider).
- See `SADIQ_PEARL_PHASE_9_REPORT.md`.

## SEO, gallery & guest reviews (Phase 10)

- **SEO helpers** live in `src/lib/seo.ts`: per-page metadata (canonical, Open Graph, Twitter), structured data from real data only, and the private paths blocked in `robots.txt`.
- **Sitemap:** `/`, `/gallery`, `/reviews`, `/book`.
- **Canonical domain:** set it with `NEXT_PUBLIC_SITE_URL` once the real domain is known.
- **Guest reviews:**
  - customers review their own **completed** bookings from `/account/bookings/{id}`;
  - the Super Admin moderates them at `/admin/reviews`;
  - only approved reviews appear on `/reviews`.
- See `SADIQ_PEARL_PHASE_10_REPORT.md`.

## Security hardening (Phase 11)

- **Response headers** (`next.config.mjs`):
  - a narrow Content-Security-Policy: `frame-ancestors`, `object-src`, `base-uri`, `form-action`. Scripts and media are not restricted;
  - HSTS on production builds;
  - no `X-Powered-By` header.
- **`NEXT_PUBLIC_SITE_URL` is required before launch.** Without it, every production build prints a placeholder-domain warning.
- See `SADIQ_PEARL_PHASE_11_REPORT.md` for the audit, the test results and the remaining production configuration.

Scroll animations use data attributes (`data-reveal`, `data-parallax`, `data-tilt`) handled by
`src/components/MotionEffects.tsx`; all motion is disabled for visitors who prefer reduced motion.

## Content status

- **CONFIRMED:** name, address, the 3 phone numbers (all on WhatsApp; inquiries go to 0345 5673921), email and TikTok from the printed card, Google rating 4.4 (8 reviews), the 3 real reviews, the menus and terms transcribed from the printed menu card.
- **Not published because unconfirmed:** prices (the card has none), guest capacity, session timings, opening hours.
- **Open question:** the printed card shows different phone numbers and the address "Nothia Road, Tabbi Tawan". The site uses the Google Business Profile details above until the client confirms which is current.
- The inquiry form opens WhatsApp with a pre-filled message. Online requests (`/book`) are requests, not confirmed bookings; slot times and prices are not published because they are unconfirmed.
