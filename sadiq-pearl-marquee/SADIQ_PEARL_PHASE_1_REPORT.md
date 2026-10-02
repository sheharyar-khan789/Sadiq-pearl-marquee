# Sadiq Pearl Marquee — Phase 1 Report (Premium Public Website Transformation)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Public website only: Home, Gallery, header/navigation, hero, sections, CTAs, footer, responsive design, motion, SEO (public pages), performance, accessibility |
| Stack | Next.js 16.3.7 (App Router, Turbopack), React 19.3.0, TypeScript 5.9, Tailwind CSS 3.4 |
| Out of scope (not touched) | Firebase, auth, customer/admin areas, booking/availability engine, database, payments, receipts, quotations, vendors, reports, notifications |

Before Phase 1 work began, the pending Phase 0.5 production-build crash was re-tested. It did not recur (exit 0), and the missing `SADIQ_PEARL_PHASE_0_5_REPORT.md` was written.

---

## 1. What was redesigned

The public site was rebuilt **visually**, not from scratch. It keeps the same Next.js project, routes, data files, verified content and WhatsApp flow, with a new design system and composition.

**Direction:** modern luxury Pakistani wedding venue. Warm ivory, deep espresso and restrained champagne-gold accents; editorial serif display type; arch motifs taken from the venue's own architecture; real venue photography and film only.

**Design system**
- **Palette (`tailwind.config.ts`):** ivory surfaces (`#fbf8f3` → `#dccfbc`), ink browns, **espresso** dark tones (`#17120f` → `#3a302a`), and gold used only as an accent. Every text colour was contrast-checked:
  - `gold.DEFAULT #7a5a26` for small text on light backgrounds: 5.1–6.0:1.
  - Champagne `#d9bc86` on espresso: 10:1.
  - `#b38e55` is decorative only on light backgrounds.
- **Type:** Cormorant Garamond (display; italic for emphasis) + Plus Jakarta Sans (UI/body), both self-hosted via `next/font`. There's a fluid heading scale and a single `eyebrow` style.
- **Components (`globals.css`):** one button system in three tones (`btn-primary` espresso, `btn-accent` champagne, `btn-outline` / `btn-outline-light`), all 44–48 px tall; plus `eyebrow`, `link-underline`, `hairline` and `container-px`.
- **Surfaces:** consistent radii (cards `rounded-2xl`/`3xl`, pill buttons), three shadow levels (`soft`, `lift`, `frame`) and hairline borders. Glass effects are limited to two small floating captions.

**Homepage order** (every section uses verified content only):
1. **Cinematic hero:** layered video depth composition (see §5–6).
2. **About + trust strip:** 4.4 rating from 8 Google reviews, lunch & dinner table service, free parking, in-house catering; layered parallax image composition.
3. **The Venue:** a wide banquet-hall feature plus four space cards (Stage, Grand Foyer, VIP Lounge, Entrance Portico) with 3D tilt.
4. **Stages & Décor** *(new, dark cinematic section)*: four portrait reels (three new stage films + the existing entrance walkthrough). The copy uses only what the printed terms verify: décor is in-house, outside decoration isn't allowed, and extra decoration/lighting/sound are charged separately.
5. **Events:** six occasions with Urdu labels and per-event WhatsApp inquiry.
6. **Catering & Menus:** accessible tabs, transcribed menus, printed-card viewer, PDF, and a "Good to know" terms strip.
7. **Gallery:** curated true-ratio masonry plus lightbox; link to the full gallery.
8. **Amenities:** Google Business Profile highlights and amenity list.
9. **Guest Reviews:** the three verbatim Google reviews, honestly framed.
10. **Visit & Contact:** address, three phone lines, WhatsApp, TikTok, Maps, and the aerial film.
11. **Book Your Event:** dark final CTA with a three-step explanation and the inquiry form.
12. **Footer**

**Not built, because no real content exists:** Packages, pricing, capacity, a services/price list, "why choose us" statistics, awards. These are deferred (§18) rather than invented.

## 2. Pages modified

| Route | Change |
|---|---|
| `/` | Fully redesigned (sections above); own canonical, OpenGraph and Twitter metadata |
| `/gallery` | Redesigned. The shell is now **server-rendered** (it was a client page), with an editorial header, breadcrumb, accessible filters and a true-ratio masonry grid. Fixed the title, canonical and OpenGraph problems from the Phase 0 audit |
| `/robots.txt`, `/sitemap.xml` | Now read the single `siteUrl` constant (value unchanged, see §17) |

Both pages now live in a `(site)` route group with a shared layout. URLs are unchanged.

## 3. Components

| Component | Status | Notes |
|---|---|---|
| `app/(site)/layout.tsx` | **New** | Shared public chrome: skip link, Navbar, `<main>`, Footer, QuickActions, BookingModal, TermsSheet, MotionEffects, escaped JSON-LD |
| `Hero.tsx` | Rewritten | Layered video hero, art-directed poster, pause control |
| `Navbar.tsx` | Rewritten | Transparent-to-solid header; full-screen mobile menu with inert/focus-trap |
| `About.tsx` | Rewritten | Trust strip + layered depth composition |
| `VenueShowcase.tsx` | **New** | Replaces the venue part of the old Highlights |
| `DecorReels.tsx` | **New** | Replaces `Videos.tsx`; in-view reels |
| `Amenities.tsx` | **New** | Replaces `Highlights.tsx`; data-driven (no fixed indexes) |
| `Events.tsx` | Rewritten | Snap carousel on phones, grid on desktop |
| `Menus.tsx` | Rewritten | Accessible tabs (`tabpanel`, `aria-controls`, arrow/Home/End keys); card lightbox |
| `Gallery.tsx` | Rewritten | True-ratio masonry, `aria-pressed` filters, focus-trapped lightbox with swipe/keys |
| `Reviews.tsx`, `Location.tsx`, `FinalCta.tsx`, `Footer.tsx` | Rewritten | New design, verified copy |
| `BookingForm.tsx` | Rewritten (same logic) | `useId` IDs, hydration-safe min date, honest success state |
| `BookingModal.tsx`, `TermsSheet.tsx` | Restyled | Bottom sheet on phones, focus trap |
| `BookNowButton.tsx` | Rewritten | Now the site-wide "Book Your Event" trigger (it was dead code) |
| `QuickActions.tsx` | **New** | Replaces `WhatsAppButton.tsx`: mobile Call · WhatsApp · Book bar + desktop WhatsApp button |
| `MotionEffects.tsx` | **New** | Single controller for reveal / parallax / tilt |
| `AmbientVideo.tsx` | **New** | In-view muted film with pause control (aerial film) |
| `Section.tsx`, `useDialog.ts`, `Icon.tsx` | Updated | New heading style; focus trap + deferred focus; pause icon; visible unfilled stars |
| **Removed** | `Highlights.tsx`, `Videos.tsx`, `WhatsAppButton.tsx`, `app/gallery/GalleryPageClient.tsx` | Replaced as listed above |

## 4. Assets added

Every new asset comes from **your supplied videos**; no stock or invented imagery.

| Asset | Source | Details |
|---|---|---|
| `public/videos/stage-rose-arch.mp4` | `WhatsApp Video … 22.59.17.mp4` | 720×1280, 24 fps, 9.6 s seamless loop, 1.34 MB |
| `public/videos/stage-blue-arch.mp4` | `… 22.59.19.mp4` | 540×960, 24 fps, 9.6 s loop, 0.85 MB |
| `public/videos/stage-red-frame.mp4` | `… 22.59.19 (1).mp4` | 540×960, 24 fps, 9.6 s loop, 0.81 MB |
| `public/videos/stage-*-poster.jpg` ×3 | Frames from the same videos | 720×1280 JPEG, 113–138 KB (posters, and two also used as gallery stills) |

- `… 22.59.19 (2).mp4` is **byte-identical** to `… 22.59.19.mp4`, so it wasn't added twice.
- The attached stage **photo** is a lower-resolution copy (1125×1500) of the existing `royal-stage.jpg` (1200×1600), so the existing higher-quality file was kept.
- The existing `public/videos/hero-exterior.mp4` is no longer referenced by the site. It was preserved, not deleted.

## 5. Video integration details

**Inspection:** all three supplied films are **portrait 9:16**, 720 px wide, 30 fps, H.264 Baseline, 6–9 s, with **no audio track**. They're bright, daytime, empty-stage pans (no guests in frame). Contact sheets were reviewed frame by frame.

**Placement decision:** stretched full-bleed across a 16:9 desktop hero, they would have been cropped by about 70% and upscaled about 2.7×. So they're used where they fit naturally:

| Where | What |
|---|---|
| Phone / tablet hero | The rose-stage film fills the portrait screen natively, with no distortion |
| Desktop hero | The same film inside an **arch-shaped frame** (the foreground depth layer). The background is the night-facade photo, softly blurred as the far plane |
| Stages & Décor | All three stage films + the existing entrance walkthrough as 9:16 reels |
| Contact | The existing aerial film (854×480) kept at its native 16:9, so it isn't upscaled or cropped |

**Optimisation (ffmpeg 7.1, libx264):**
- Trimmed to each clip's strongest pan, then played **forward then reversed** so the loop is seamless, with no jump cut.
- 24 fps, light temporal denoise (`hqdn3d`), High profile, CRF 29, `-movflags +faststart`, audio stripped.
- About 140 KB/s versus the source's 230 KB/s, with visually equivalent quality (checked frame by frame).
- Reel-only clips are scaled to 540×960, about 2× their on-screen card width.

**Loading behaviour:**
- **One hero video per device**: phones load only the full-bleed film; desktop loads only the portal film. The desktop background stays a still photo, saving about 1.4 MB.
- The hero video is fetched **only after the page `load` event**, so the poster (the LCP image) is never competing with it.
- It's **skipped entirely** under `prefers-reduced-motion` or the browser's Save-Data setting.
- The hero pauses when scrolled off-screen, and has a visible **pause/play button** (WCAG 2.2.2).
- Reels and the aerial film use `preload="none"`. They play only while at least 60% (40% for the aerial) visible, each has its own play/pause button, and none autoplays under reduced motion.
- **Measured in headless Chrome:** on first load, only the hero video had downloaded; every other video was at `readyState 0` (no bytes fetched).
- All videos are `muted` and `playsInline`, and posters show until the first frame plays.
- **Text over video:** a darkening gradient plus an extra 30% dim layer on phones (the stage films are bright). Checked visually at 320, 375, 390, 430 and 768 px.

## 6. 3D / depth techniques used

No WebGL and **no new dependency**. Everything is CSS transforms plus one ~150-line client controller (`MotionEffects.tsx`) that writes CSS variables directly, with no React re-renders.

| Technique | Where |
|---|---|
| **Three-plane depth of field**: blurred far background, sharp arch "portal" film in the middle, crisp text in front | Desktop hero |
| **Scroll parallax** at different speeds per layer (`data-parallax`) | Hero portal and caption card; About image stack; Amenities arch frame |
| **Pointer-driven 3D tilt** (`data-tilt`, perspective + rotateX/Y, caption lifted with `translateZ`) on mouse/trackpad only | Hero portal, venue space cards, event cards |
| **Perspective reveal** (`data-reveal="depth"`: rises from `translateZ(-60px) rotateX(6deg)`) | Feature images, form card, aerial film |
| **Layered compositions** (overlapping frames, offset outline frames, floating caption cards) | Hero, About, Amenities |
| Scale-on-hover imagery (slow 1.2–1.4 s ease) | Cards, gallery |

**Safety:**
- Everything is off under `prefers-reduced-motion` (CSS and JS).
- Tilt is disabled on touch devices.
- The reveal system has no-JS and script-failure fallbacks, so content is never left invisible.
- Hero entry animations use `both` fill mode, which fixes the Phase 0 hero flicker (P2-1).

## 7. Mobile improvements (designed mobile-first, not stacked desktop)

- **Portrait full-bleed film hero** (100 svh) with bottom-anchored copy and full-width primary/secondary CTAs.
- **First-class full-screen menu:** large serif links (60 px rows), staggered entrance, Book + WhatsApp + all three phone numbers + address. It's `inert` when closed, focus-trapped when open, closes with Escape, and locks scroll.
- **Bottom action bar** (Call · WhatsApp · Book Your Event). It appears only after the hero, so it never duplicates the hero CTAs. It respects the safe area, is inert while hidden, and shortens to "Book Event" below 360 px.
- **Swipe carousels with snap and a visible peek** for venue spaces, décor reels, events and printed menu sheets, aligned to the page gutter (`scroll-padding`).
- A 2×2 trust strip, a 2-column masonry gallery with always-visible captions on touch, and bottom-sheet dialogs.
- Touch targets are 44–48 px. The page base is 16 px text, and no text is smaller than 11 px except the decorative "MARQUEE" wordmark line.
- Explicit single-column grids, so no long label can widen a column. This was verified at 320 px after catching one such case.

## 8. Desktop improvements

- A cinematic layered hero with an arch portal film, and a transparent header that turns to frosted ivory on scroll.
- Editorial asymmetric 12-column layouts, generous section rhythm (`py-36`), and sticky media in Contact.
- The full navigation shows from 1280 px. Between 1024 and 1279 px the header uses Book + WhatsApp + Menu, to avoid the crowding found in QA.
- A discreet champagne floating WhatsApp button after the hero, and footer spacing so it never covers content.

## 9. Accessibility improvements

- **Skip link** to `<main>`.
- One `<h1>` per page and correct section `<h2>`/`<h3>`.
- Every section is labelled (`aria-labelledby`), and all images have meaningful `alt` text (decorative ones use `alt=""`).
- **Closed mobile menu:** `inert` with 0 focusable controls (measured). Fixes Phase 0 P1-7.
- **Dialogs** (menu, booking, terms, both lightboxes): focus moves in on open, Tab is trapped, Escape closes, focus returns to the trigger, and page scroll is locked. All measured.
- **Menus:** complete ARIA tab pattern with keyboard support. **Gallery filters:** `aria-pressed` toggle buttons.
- **Form:** labelled fields, `aria-invalid` + `aria-describedby` errors announced via `role="alert"`, and unique IDs even with two form instances (measured).
- **Video:** muted, a pause control on every autoplaying video, `aria-label`s, and no autoplay under reduced motion.
- **Focus:** a visible champagne focus ring on light and dark backgrounds.
- **Contrast:** all text colours checked (§1). Star ratings now show their unfilled part, so a 3-star review no longer looks like 5 stars.
- **Desktop keyboard order (measured):** skip link → logo → 7 nav links → WhatsApp → Book → hero CTAs → pause, with no hidden or off-screen stops.

## 10. SEO improvements

- Unique titles:
  - `/` → "Sadiq Pearl Marquee | Wedding & Event Venue in Sarai Alamgir"
  - `/gallery` → "Photo Gallery | Sadiq Pearl Marquee" (the duplicated brand is fixed)
- Unique meta descriptions for each page.
- **Canonical per page:** `/gallery` now declares `/gallery`; previously it pointed at `/`.
- **Full OpenGraph on every page** (`og:url`, `og:site_name`, `og:locale`, `og:type`, image with dimensions and alt) via the shared `baseOpenGraph`. Next.js replaces rather than merges `openGraph`, which is what dropped these tags before. Twitter cards are set too.
- **JSON-LD `EventVenue`:** now escaped against `</script>` injection (Phase 0 P3-11). It adds `logo`, `addressRegion` (Punjab), `hasMap` (the verified Maps link) and `sameAs` (the verified TikTok). It's rendered once in the public layout.
- Sitemap and robots unchanged in structure and read from the single `siteUrl` constant.
- Semantic landmarks (`header`/`nav`/`main`/`footer`/`address`/`figure`/`blockquote`), a breadcrumb on `/gallery`, and descriptive image alt text.
- **The domain is still unresolved.** No guessed domain was introduced (§17).

## 11. Performance improvements

- **Fonts:** Google Fonts `<link>` (render-blocking, third-party) replaced by self-hosted `next/font` with `display: swap`.
- **Hero LCP:** one art-directed `<picture>` poster (via `getImageProps`), so only the right poster downloads per device, eagerly with `fetchpriority="high"`.
- **Video:** deferred until after `load`, one film per device, `preload="none"` everywhere else, and in-view play/pause, as described in §5.
- **No re-renders on scroll:** parallax and tilt write CSS variables in `requestAnimationFrame`. The old hero set React state every frame (P2-3).
- **Less client JS:** About, Venue, Events, Amenities, Reviews, Contact, Book section and the gallery page shell are server components. Only interactive islands are client components.
- **Images:** `next/image` everywhere with `sizes`; gallery images carry real width/height, so there's no layout shift; lazy loading below the fold; WebP output; `sharp` present.
- **Dependencies:** no new runtime dependencies.
- **Caveat:** Next 16 no longer prints per-route JS sizes, and Lighthouse wasn't run (§17).

## 12. Dependencies added / removed

**Phase 1: none.** No packages were added, removed or updated. The effects are CSS plus about 150 lines of in-house TypeScript. (Phase 0.5 changes are in `SADIQ_PEARL_PHASE_0_5_REPORT.md`.) The ffmpeg used for video encoding ran from a temporary folder outside the project and is not a project dependency.

## 13. TypeScript result

`npm run typecheck` (`tsc --noEmit`): **exit 0**, no errors.

## 14. ESLint result

`npm run lint` (`eslint .`): **exit 0 — 0 errors, 1 warning**. The warning, `import/no-anonymous-default-export` in `postcss.config.mjs`, predates Phase 1 and was left as-is. This is down from 9 warnings at the end of Phase 0.5: the rewritten components no longer call setState inside effects, and unused imports are gone.

## 15. Build result

`next build` (Next 16.3.7, Turbopack): **exit 0**. It compiled successfully and prerendered all routes (`/`, `/gallery`, `/robots.txt`, `/sitemap.xml`, `/_not-found`) as static. `npm audit`: **0 vulnerabilities**.

## 16. Browser QA result

**Method.** The embedded browser pane stopped repainting at emulated sizes, so QA used **headless Chrome over the DevTools protocol**, with a throwaway profile and true device emulation (DPR 2 + touch for phones). The scripts lived in a temp folder outside the project. Every section was screenshotted and reviewed, and the automated checks were re-run on the final build.

| Width | Horizontal overflow | Broken images | Console errors / exceptions | Notes |
|---|---|---|---|---|
| 320 × 700 (mobile) | none | 0 | 0 | Overflow found at one point, fixed and re-verified |
| 375 × 812 (mobile) | none | 0 | 0 | |
| 390 × 844 (mobile) | none | 0 | 0 | |
| 430 × 932 (mobile) | none | 0 | 0 | |
| 768 × 1024 (tablet) | none | 0 | 0 | |
| 1024 × 768 (desktop) | none | 0 | 0 | Nav crowding found at one point, fixed |
| 1280 × 800 (desktop) | none | 0 | 0 | |
| 1440 × 900 (desktop) | none | 0 | 0 | |
| `/gallery` at 320 and 1440 | none | 0 | 0 | |

**Interaction checks (automated, final build):**
- Mobile menu: open, focus moves in, trapped, Escape closes, focus returns, scroll locked and unlocked. ✅
- Closed menu has 0 focusable controls. ✅
- Book Your Event modal opens with focus. ✅
- Empty submit shows all 5 required-field errors. ✅
- Unique IDs across both form instances. ✅
- `/gallery` Booking terms opens (Phase 0 bug B2). ✅
- Gallery filter sets `aria-pressed` and shows the right photos. ✅
- Lightbox keyboard navigation and focus return. ✅
- Desktop keyboard order clean. ✅
- **No hydration errors** or runtime exceptions on any run. ✅

**Links:** all 32 WhatsApp links on `/` point to the unchanged verified number (`wa.me/923455673921`). The `tel:` links are the three configured numbers. All routes return 200 (unknown routes return 404), and all video/PDF assets return 200.

**Issues found in visual QA and fixed:**
- **Mobile hero text** was hard to read over the bright stage film. Added a dim layer and a stronger gradient.
- **Neon facade sign** competed with the desktop headline. Added depth-of-field blur and a stronger gradient.
- **Mislabelled photos:**
  - The "exterior colonnade" is actually the interior foyer.
  - The "daytime facade/parking" photo is the columned entrance portico and shows no parking.
  - The "Peacock Floral Art Piece" contains no peacock.
  - "Custom Event Backdrop" and "Celebration Stage Arch" didn't match their photos.

  All were retitled to describe what is shown, and the categories were corrected.
- **A camera-app screenshot** (`interior-chandelier-lobby.jpg`, with on-screen camera readouts) had been used in a feature card. It was removed from features and moved to the end of the gallery.
- **Star ratings** showed 3-star and 4-star reviews as 5 stars (the unfilled colour was invisible).
- **Mobile menu focus:** focus failed to move into the menu (a visibility transition timing problem).
- **Layout fixes:**
  - Phone numbers wrapped on desktop.
  - The floating WhatsApp button covered the footer's terms link.
  - Event cards were too tall on desktop.
  - The Venue/Events carousels snapped flush against the screen edge.
  - The mobile bottom-bar label wrapped at 320 px.
  - The 1024 px nav crowded.
  - "Discover" overlapped on short screens.
  - A form column widened at 320 px.
  - Duplicate "View all photos" buttons on phones.
  - A spacing glitch in the hero eyebrow.

## 17. Known limitations

- **Domain unresolved:** `siteUrl` is still the placeholder `https://www.sadiqpearlmarquee.com`, which does not resolve (NXDOMAIN). It's now in **one place** (`src/lib/config.ts`) but was deliberately **not** replaced with a guess. Canonical, OpenGraph, sitemap, robots and JSON-LD will be correct once the real domain is set there.
- **Not tested on physical devices:** real iOS Safari / Android Chrome. Emulation used Chromium only, and Firefox/Safari rendering wasn't checked. Lighthouse / Core Web Vitals weren't measured.
- **Source media quality:**
  - The WhatsApp films are 720 px wide, so the phone hero is sharp but slightly soft on large portrait tablets (768–1023 px).
  - The desktop background photo is 1024 px, which is masked by the intentional blur.
  - Several photos are 576 px wide.
  - One photo contains camera UI.
  - The logo is a photograph of signage, and its green isn't in the palette.
- **Hero film timing:** it starts after the page `load` event. On slow connections, visitors see the poster first (by design).
- AVIF image output remains off (a separate decision, noted in `next.config.mjs`).
- Urdu labels use the device's own Urdu fonts; no web font is loaded.
- **Content in place but still needing client confirmation:** events descriptions (still marked PLACEHOLDER in the data), the phone/address conflict with the printed card, and the fireworks photo versus the "no fireworks" term. Two Urdu event labels were simplified (شادی مبارک → شادی, مہندی تقریب → مہندی) to work as category names. Revert these if the client prefers the originals.

## 18. Deferred work (future phases or client input)

- **Content the client must supply:**
  - packages and pricing, per-head rates, capacity, Day/Night slot times, services and their prices;
  - opening hours;
  - the production domain;
  - a vector logo and brand colour;
  - high-resolution hall/stage/décor photography and a clean menu-card scan;
  - a replacement for the camera-UI lobby photo.
- **Site work:**
  - **Packages** and **services/amenities with pricing** sections: the structure is ready, but no data exists yet.
  - Dedicated routes (events, menus, contact) for local SEO; currently hash sections on `/`.
- **Tooling and clean-up:**
  - An ESLint 10 migration (blocked on `eslint-config-next`).
  - Untrack `next-env.d.ts` in git.
  - Remove unused config (`media.daytimeFacade`, `business.whatsappHref`, `buildSmsUrl`) and the now-unreferenced `hero-exterior.mp4`, if the client doesn't want it.
  - Consider AVIF.
  - Real-device testing and a Lighthouse pass.
- **All application phases:** Firebase, authentication, customer portal, admin panel, booking/availability engine, payments, receipts, quotations, vendors, reports, notifications. **Not started.**

---

## Every modified file (Phase 1)

**New**
- `src/app/(site)/layout.tsx`
- `src/components/AmbientVideo.tsx`
- `src/components/Amenities.tsx`
- `src/components/DecorReels.tsx`
- `src/components/MotionEffects.tsx`
- `src/components/QuickActions.tsx`
- `src/components/VenueShowcase.tsx`
- `src/lib/seo.ts`
- `public/videos/stage-rose-arch.mp4`, `stage-blue-arch.mp4`, `stage-red-frame.mp4`
- `public/videos/stage-rose-arch-poster.jpg`, `stage-blue-arch-poster.jpg`, `stage-red-frame-poster.jpg`
- `SADIQ_PEARL_PHASE_0_5_REPORT.md` (overdue Phase 0.5 deliverable)
- `SADIQ_PEARL_PHASE_1_REPORT.md` (this file)

**Moved**
- `src/app/page.tsx` → `src/app/(site)/page.tsx` (rewritten)
- `src/app/gallery/page.tsx` → `src/app/(site)/gallery/page.tsx` (rewritten)

**Modified**
- `src/app/layout.tsx`: `next/font`, metadata base, `js` class, shared OpenGraph
- `src/app/globals.css`: design system + motion system
- `src/app/robots.ts`, `src/app/sitemap.ts`: use `siteUrl`
- `src/components/About.tsx`, `BookNowButton.tsx`, `BookingForm.tsx`, `BookingModal.tsx`, `Events.tsx`, `FinalCta.tsx`, `Footer.tsx`, `Gallery.tsx`, `Hero.tsx`, `Icon.tsx`, `Location.tsx`, `Menus.tsx`, `Navbar.tsx`, `Reviews.tsx`, `Section.tsx`, `TermsSheet.tsx`, `useDialog.ts`
- `src/data/events.ts`: photo/alt moved into data; two Urdu labels simplified
- `src/data/gallery.ts`: real dimensions, corrected captions/categories, two new stills, `reels` list
- `src/lib/config.ts`: `siteUrl` constant (unchanged value), new media paths
- `src/lib/whatsapp.ts`: derives the WhatsApp number from config (same value)
- `tailwind.config.ts`: new tokens
- `next.config.mjs`: `turbopack.root`
- `README.md`: updated stack and "where to edit" guide

**Deleted**
- `src/components/Highlights.tsx`, `Videos.tsx`, `WhatsAppButton.tsx`
- `src/app/gallery/GalleryPageClient.tsx`

**Unchanged by design:** all business values (phones, WhatsApp number, address, rating, menus, terms, reviews), `package.json` and `package-lock.json` (no dependency changes in Phase 1), `public/images/**`, `public/menu/**`.
