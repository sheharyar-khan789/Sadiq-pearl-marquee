# Sadiq Pearl Marquee — Phase 0 Audit & Baseline

| | |
|---|---|
| Audit date | 2026-09-29 |
| Scope | Existing project, read-only audit. No source changes. |
| Project location | `Downloads/sadiq-pearl-marquee-website/sadiq-pearl-marquee/` (the supplied zip is byte-identical to this folder) |
| Git | Repo root `sadiq-pearl-marquee-website/`, branch `main`, single commit `1b3a59c "Initial production release"`, clean working tree before this audit |
| Build method | The project was copied to a temporary folder outside the repo, and `npm ci`, the type check, lint and the production build ran there, so the repo gained no `node_modules/` or `.next/` |

Severity key: **P0** = critical, **P1** = important, **P2** = improvement, **P3** = minor.

---

## 1. Executive summary

The project is a small, clean, **static marketing site**: Next.js 14 App Router, React 18, TypeScript (strict) and Tailwind 3. It has **2 routes** (`/`, `/gallery`) plus `robots.txt` and `sitemap.xml`, about 4,400 lines of source and only 3 runtime dependencies. All content comes from typed TS modules in `src/data` and `src/lib/config.ts`. Nothing talks to a server: no API routes, no database, no auth, no Firebase and no env vars. Every "booking" is a **WhatsApp click-to-chat link** (`wa.me`) with a pre-filled message.

Much is already right. Content discipline is strong: unconfirmed facts such as prices, capacity, timings and hours are left out on purpose, and the README records what is confirmed. The site uses `next/image` throughout, gives Urdu text `lang="ur"`/`dir="rtl"`, respects reduced motion in CSS, and sends basic security headers.

The main problems:

1. **The production domain is a placeholder that does not exist.** `www.sadiqpearlmarquee.com` returns NXDOMAIN, yet canonical, OG, sitemap, robots and JSON-LD all point to it. (P0)
2. **The repo has no `.gitignore`.** Any `npm install`, build or future `.env`/Firebase service-account file would show as untracked and could be committed. This must be fixed before any Firebase work. (P0)
3. **`next@14.2.35` has a CRITICAL `npm audit` rating (21 advisories, including unauthenticated RCE on Windows hosts and in the image optimizer).** The only fix is a major upgrade to Next 16. (P0)

The project **installs, type-checks and builds cleanly** (`tsc` exit 0, `next build` exit 0, First Load JS 123 kB). **Lint cannot run**: there is no ESLint config.
4. **Broken or dead UI paths.** The booking modal can never open, because nothing calls `open()`. The footer "Booking terms" button does nothing on `/gallery`. `/gallery` declares `/` as its canonical URL.
5. **Hardcoded business data despite the config file.** The WhatsApp number is hardcoded in `whatsapp.ts` and appears as a literal in 14 files (about 30 occurrences). The address text is repeated in copy across many components.
6. **Architecture fit.** The single-page, hash-anchor design and the one global root layout will need restructuring (route groups, per-area layouts, real routes) before a portal or admin can be added. None of this blocks the work, but it is the first structural job of Phase 1.

---

## 2. Current technology stack

| Item | Actual value (from files) |
|---|---|
| Framework | Next.js, App Router (`src/app`) |
| Next.js | `^14.2.35` (lockfile resolves 14.2.35) |
| React / React DOM | `^18.3.1` |
| TypeScript | `^5`, `strict: true`, `moduleResolution: bundler`, alias `@/* → ./src/*` |
| Styling | Tailwind CSS `^3.4.13` + PostCSS + Autoprefixer; `tailwind.config.ts` with custom tokens |
| Package manager | npm (`package-lock.json` lockfileVersion 3) |
| Runtime deps | `next`, `react`, `react-dom` only |
| Dev deps | `@types/node`, `@types/react`, `@types/react-dom`, `autoprefixer`, `postcss`, `tailwindcss`, `typescript` |
| ESLint | **Not configured.** No `.eslintrc*`, and `eslint`/`eslint-config-next` are not installed, although `"lint": "next lint"` exists |
| Tests | None |
| Formatter | None (no Prettier config) |
| CI | None |
| Hosting config | None (no `vercel.json`, `firebase.json` or `Dockerfile`). Needs a Node runtime because it uses `next/image` optimisation, `headers()` and dynamic `sitemap`/`robots`. It is not a static export. |
| Node | README says 18.18+ (tested on 22). This machine has Node 24.18.1 / npm 11.16.0 |
| Fonts | Google Fonts via `<link>` in `layout.tsx`: Playfair Display and Plus Jakarta Sans. `next/font` is **not** used |
| Animation | CSS keyframes in Tailwind (`fadeInUp`, `fadeIn`, `scaleIn`) and one JS scroll parallax in `Hero.tsx`. No animation library |
| 3D / WebGL | **None** |
| Icons | Inline SVG set in `components/Icon.tsx` (no icon font or library) |
| Firebase | **None** |
| Auth | **None** |
| Env vars | **None.** No `.env*` files and no `process.env` usage |
| API / server routes | **None.** No `route.ts`, no server actions, no middleware |
| Analytics / tracking | None |

---

## 3. Project structure

```
sadiq-pearl-marquee-website/            ← git root (no .gitignore)
└── sadiq-pearl-marquee/                ← Next.js app root
    ├── README.md                       content-status notes (valuable)
    ├── next.config.mjs                 security headers, WebP only (AVIF disabled, see §13)
    ├── tailwind.config.ts              design tokens
    ├── postcss.config.mjs, tsconfig.json, next-env.d.ts
    ├── package.json, package-lock.json
    ├── public/
    │   ├── favicon.ico (64×64)
    │   ├── images/{logo.jpg, hero/, exterior/, interior/, events/, decoration/, dining/, gallery/}
    │   ├── menu/{sheet-1..3.jpg, sadiq-pearl-marquee-menu-card.pdf}
    │   └── videos/{hero-exterior.mp4, entrance-tour.mp4 (+poster), exterior-aerial.mp4 (+poster)}
    └── src/
        ├── app/
        │   ├── layout.tsx              global metadata, JSON-LD, Google Fonts <link>
        │   ├── page.tsx                home page (composes all sections)
        │   ├── globals.css
        │   ├── robots.ts, sitemap.ts
        │   └── gallery/{page.tsx, GalleryPageClient.tsx}
        ├── components/                 21 files (see §5)
        ├── data/                       events, gallery (+videos), highlights, menu (+terms), reviews
        └── lib/                        config.ts (business config), whatsapp.ts (link builders)
```

Outside the project: `Downloads/stitch_sadiq_pearl_marquee_redesign (1)/` holds only an **empty** `DESIGN.md` (0 bytes). `tailwind.config.ts` refers to "the Google Stitch redesign", but that design reference is not on disk.

---

## 4. Route / page inventory

### Routes that exist

| Route | File | Type | Notes |
|---|---|---|---|
| `/` | `src/app/page.tsx` | Server page that renders client sections inside `BookingProvider` | Single long page; every "page" below is an **anchor section** of it |
| `/gallery` | `src/app/gallery/page.tsx` → `GalleryPageClient.tsx` | Server wrapper; the whole body is a client component | Full 26-photo gallery |
| `/robots.txt` | `src/app/robots.ts` | Metadata route | Allow all; sitemap on the placeholder domain |
| `/sitemap.xml` | `src/app/sitemap.ts` | Metadata route | `/` and `/gallery`; `lastModified` = build time |

### Requested public pages: status

| Page | Exists? | Where | Main components | Content source | Media | Forms / interactivity | Mobile behaviour | Problems | Depends on |
|---|---|---|---|---|---|---|---|---|---|
| **Home** | Yes (route `/`) | `app/page.tsx` | Navbar, Hero, all sections, Footer, WhatsAppButton, BookingModal, TermsSheet | Components + `lib/config.ts` | `hero-primary.jpg`, `hero-exterior.mp4` | Hero video autoplay, desktop parallax, WhatsApp CTAs | Hero stacks text above media; CTAs full width | Hero text flicker (§11 P2); 16:9 hero image cropped into a 4:5 frame | config, whatsapp |
| **About** | Section `#about` | `components/About.tsx` | SectionHead, Stars | Inline copy + `venueFeatures` | `gallery/crystal-hall.jpg`, `gallery/entrance-lobby.jpg` | WhatsApp CTA, link to `#features` | 2-image composition stays side by side (7/5 cols) at all widths | Copy claims "verified Google reviews from attending families" (not supported by the data) | config |
| **Venue / Features** | Section `#features` (+ `#venue`, `#highlights` aliases) | `Highlights.tsx` | SectionHead | `data/highlights.ts` + inline copy | `interior-banquet-full.jpg`, `exterior-daytime-facade.jpg`, `decoration-chandelier-detail.jpg` | WhatsApp CTA | Stacks | Indexes `highlights[0..3]` by position, so it breaks if the array changes; portrait photos cropped to 16:10 | data/highlights |
| **Events** | Section `#events` | `Events.tsx` | SectionHead | `data/events.ts` (marked PLACEHOLDER) + `eventMedia` map inside the component | 6 photos reused from the gallery | Per-event WhatsApp link | 1 → 2 → 3 columns | Event→image mapping hardcoded in the component; descriptions are placeholders | data/events |
| **Halls / Services** | **No** | — | — | — | — | — | — | No hall page and no services list. Only the Terms mention "extra decoration, lighting, sound" | — |
| **Menus** | Section `#menus` | `Menus.tsx` (client, 543 lines) | SectionHead, MenuCard, lightbox | `data/menu.ts` (transcribed from the printed card) | `menu/sheet-1..3.jpg`, PDF | 4 tabs, sheet selector, fullscreen lightbox (keyboard ←/→), PDF download, per-menu WhatsApp links | Desktop shows a selector + preview; mobile shows all 3 sheets stacked | Custom tab ARIA incomplete; desktop preview is a clickable `<div>` with no keyboard access; no prices (deliberate) | data/menu, BookingContext (terms) |
| **Packages** | **No** | — | — | — | — | — | — | Nothing exists | — |
| **Gallery** | Section `#gallery` + route `/gallery` | `Gallery.tsx` (client) | SectionHead, lightbox | `data/gallery.ts` | 26 photos | Category filter, lightbox with keyboard + swipe, per-photo WhatsApp link | 1 → 2 → 3 → 4 columns; swipe in lightbox | `/gallery` canonical points to `/`; title duplicated; "All (26)" pill shows 12 on home; `aspect` metadata contradicts the real image orientation | data/gallery |
| **Videos** | Section `#videos` (not in nav) | `Videos.tsx` (client) | SectionHead | `data/gallery.ts` → `videos` | 3 MP4s + posters | Click-to-play (video mounted on click) | Stacks | Copy "Management available daily" is an **unconfirmed hours claim** | data/gallery |
| **Reviews** | Section `#reviews` (not in nav) | `Reviews.tsx` | SectionHead, Stars | `data/reviews.ts` (3 real GBP reviews) + `business.rating` | none | Links to Google Maps | Stacks | Intro claims the reviews are from families who held weddings, which the data doesn't support; label says "Occasion: Lunch" but the field is a dining type | config, data/reviews |
| **Contact** | Section `#contact` (+ `#location`) | `Location.tsx` | SectionHead, TikTokGlyph | `lib/config.ts` | `exterior-daytime-facade.jpg` | `tel:` links, Maps link, WhatsApp, TikTok | Phones in a 3-column grid on ≥sm | No embedded map (deliberate: link only); WhatsApp number hardcoded in copy | config |
| **Booking** | Section `#inquire` (+ `#reserve`) and an **unreachable** modal | `FinalCta.tsx` → `BookingForm.tsx`; `BookingModal.tsx` | BookingForm | `lib/config.ts` option lists | none | Client-validated form → opens `wa.me` with the message pre-filled; success summary; terms link | 1 → 2 columns | Nothing is stored or sent to a server; success screen shows even if the pop-up was blocked; modal is dead code | config, whatsapp, BookingContext |

**Navigation**: the header nav lists Home, About, Venue/Features, Events, Menu, Gallery, Contact, all as `#hash` links. Videos, Reviews and Inquire sections are not in the nav.

---

## 5. Component inventory

| Component | Client? | Lines | Purpose | Used by | Status |
|---|---|---|---|---|---|
| `Navbar.tsx` | yes | 308 | Fixed header, desktop links, mobile slide-over drawer, WhatsApp CTAs, phone list | `/`, `/gallery` | Works; a11y issues (§11) |
| `Hero.tsx` | yes | 271 | H1, tagline, badges, CTAs, hero video over a poster image, desktop parallax | `/` | Works; flicker & reduced-motion issues |
| `About.tsx` | no | 188 | Story, rating, amenity pills, 2 images, 3 pillars | `/` | Works |
| `Highlights.tsx` | no | 172 | Venue features editorial layout | `/` | Works; positional indexing |
| `Events.tsx` | no | 136 | 6 event cards with WhatsApp links | `/` | Works |
| `Menus.tsx` | yes | 543 | Menu tabs, sheet viewer, lightbox, `MenuCard` | `/` | Works; largest component; a11y gaps |
| `Gallery.tsx` | yes | 337 | Filterable grid + lightbox (shared by home and `/gallery`) | `/`, `/gallery` | Works |
| `Videos.tsx` | yes | 232 | Featured video + 2 supporting, click-to-play | `/` | Works |
| `Reviews.tsx` | no | 117 | Rating summary, 3 reviews, Google highlights | `/` | Works; copy accuracy |
| `Location.tsx` | no | 211 | Address, phones, WhatsApp, TikTok, facade photo, Maps | `/` | Works |
| `FinalCta.tsx` | no | 72 | Inquiry section wrapper around `BookingForm` | `/` | Works |
| `BookingForm.tsx` | yes | 404 | Inquiry form → WhatsApp | `FinalCta`, `BookingModal` | Works (WhatsApp hand-off only) |
| `BookingModal.tsx` | yes | 27 | Modal around `BookingForm` | `/` | **Dead**: never opened |
| `BookNowButton.tsx` | yes | 18 | Button that calls `open()` | **nowhere** | **Dead code** |
| `BookingContext.tsx` | yes | 36 | UI state: booking modal + terms sheet | `/`, `/gallery` | Works; misleading name for future booking domain |
| `TermsSheet.tsx` | yes | 40 | Terms & conditions dialog | `/` only | Works on `/`; **not mounted on `/gallery`** |
| `WhatsAppButton.tsx` | yes | 50 | Floating WhatsApp pill | `/`, `/gallery` | Works |
| `Footer.tsx` | yes | 158 | 4-column dark footer, links, contacts, terms button | `/`, `/gallery` | Terms button broken on `/gallery` |
| `Section.tsx` (`SectionHead`) | no | 19 | Eyebrow + H2 + intro | most sections | Works |
| `Icon.tsx` | no | 92 | Inline SVG icons, `Stars`, `WhatsAppGlyph`, `TikTokGlyph` | many | Several icon names unused (`chat`, `calendar`, `light`, `clock`, `mail`, `video`, `shield`) |
| `useDialog.ts` | yes | 22 | Scroll lock, Escape to close, focus the close button, restore focus | Menus, Gallery, BookingModal, TermsSheet | No focus trap |
| `app/gallery/GalleryPageClient.tsx` | yes | 104 | Gallery page shell (breadcrumb, header, CTA) | `/gallery` | Works; whole page is a client component |

**Layouts**: only `src/app/layout.tsx` (the root). It adds site-wide public metadata, JSON-LD and fonts to **every** route.

**Data layer** (`src/data`, `src/lib`):

| File | Content | Status label in file |
|---|---|---|
| `lib/config.ts` | Name, tagline, 3 phones, WhatsApp number, address, rating 4.4 / 8 reviews, Maps URL, TikTok, amenities, form option lists, core media paths | Mix of CONFIRMED and PLACEHOLDER; well annotated |
| `lib/whatsapp.ts` | `getWhatsAppUrl`, `buildWhatsAppUrl`, `buildSmsUrl` (unused); **its own hardcoded number constants** | — |
| `data/menu.ts` | 7 wedding menus, 2 mehndi menus, desserts/salads/drinks, 3 sheet images, PDF path, 8 translated terms | Transcribed from the card; no prices |
| `data/gallery.ts` | 26 gallery items (4 categories), 3 videos | "Verified" |
| `data/events.ts` | 6 event categories with Urdu labels, `enabled` flag | PLACEHOLDER descriptions |
| `data/highlights.ts` | 4 highlights | CONFIRMED (from GBP features) |
| `data/reviews.ts` | 3 verbatim GBP reviews + 2 Google summary lines | CONFIRMED |

---

## 6. Existing functionality, and build/test results

All commands ran on a **copy** of the project in a temporary folder outside the repo (Node 24.18.1, npm 11.16.0, Windows 11).

| Check | Command | Result |
|---|---|---|
| Install | `npm ci` | ✅ 105 packages added from the lockfile. (It took 42 min, because of this machine's network: one registry request took 110 s. That is not a project issue.) |
| Type check | `npx tsc --noEmit` | ✅ **exit 0**, no type errors |
| Lint | `CI=1 npx next lint` | ❌ **exit 1**: stops at the interactive prompt "How would you like to configure ESLint?" No ESLint config or packages exist (B7) |
| Production build | `npx next build` (Next 14.2.35) | ✅ **exit 0**: "Compiled successfully", 7/7 static pages |
| Production server | `npx next start -p 3107` | ✅ Starts. ⚠ Warns that the `sharp` package is missing, so production image optimisation falls back to a slower path |
| Security audit | `npm audit` | ❌ **2 vulnerabilities: 1 critical (`next`), 1 high (`postcss` bundled inside next)**. See below |
| Outdated | `npm outdated` | next 14.2.35 → latest 16.3.7; react/react-dom 18.3.1 → 19.3.0; tailwindcss 3.4.19 → 4.3.3; typescript 5.9.3 → 7.0.2; @types/* one major behind |

**Build output (route table):**

```
Route (app)                              Size     First Load JS
┌ ○ /                                    11.1 kB         123 kB
├ ○ /_not-found                          873 B          88.1 kB
├ ○ /gallery                             1.5 kB          113 kB
├ ○ /robots.txt                          0 B                0 B
└ ○ /sitemap.xml                         0 B                0 B
+ First Load JS shared by all            87.3 kB
○  (Static)  prerendered as static content
```

**`npm audit`: `next@14.2.35` (critical).** It lists 21 advisories, including:
- GHSA-p293-qw3h-jr36: *Unauthenticated Remote Code Execution on Windows-hosted servers*
- GHSA-2xp9-vwfh-vxw4: *Unauthenticated RCE in the Image Optimization API when AVIF files are used* (the one the repo mitigates by disabling AVIF)
- GHSA-h64f-5h5j-jqjh: image optimisation DoS. GHSA-3x4c-7xq6-9pq8: unbounded `next/image` disk cache
- Server Components / Server Actions DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-m99w-x7hq-7vfj); RSC cache poisoning (GHSA-vfv6-92ff-j949, GHSA-wfc6-r584-vfw7); response-body cache confusion (GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q)
- SSRF in rewrites / WebSocket upgrades / Server Actions (GHSA-p9j2-gv94-2wf4, GHSA-c4j6-fc7j-m34r, GHSA-89xv-2m56-2m9x); request smuggling in rewrites (GHSA-ggv3-7p47-pfv8); middleware redirect cache poisoning (GHSA-3g8h-86w9-wvmq); disclosure of internal Server Function endpoints (GHSA-955p-x3mx-jcvp); XSS with CSP nonces or `beforeInteractive` scripts (GHSA-ffhc-5mcf-pf4q, GHSA-gx5p-jg67-6x7h)

`postcss` (inside `node_modules/next`, high): GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849.

npm's only fix is `next@16.3.7`, **a breaking major upgrade**. Many of these advisories target features this site doesn't use yet (rewrites, middleware, Server Actions, CSP nonces, i18n Pages Router). But Phase 1 *will* add middleware, Server Actions and auth, and the image optimizer and RSC advisories apply today.

**Built-HTML checks** (`.next/server/app/*.html`):
- `/gallery` `<title>` = `Photo Gallery | Sadiq Pearl Marquee | Sadiq Pearl Marquee` (B4, confirmed)
- `/gallery` `<link rel="canonical" href="https://www.sadiqpearlmarquee.com">`, i.e. the home page (B3, confirmed)
- `/gallery` OpenGraph has only `og:title`, `og:description` and `og:image`. The page's `openGraph` object replaces the root one, so `og:url`, `og:site_name`, `og:locale` and `og:type` are lost (P3-13)
- HTML entities in `SectionHead` string props (e.g. `"Catering &amp; Menus"`) render correctly as "&" (checked: no `&amp;amp;` in output)
- Built CSS has **no rules** for `h-13`, `mt-18` or `duration-400` (B8, confirmed). `.delay-100…500` produce both `transition-delay` (Tailwind built-in) and `animation-delay` (custom)

**HTTP checks** (`next start`): `/`, `/gallery`, `/robots.txt`, `/sitemap.xml`, the menu PDF and the hero MP4 return 200; an unknown path returns 404. The response headers include `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`; no CSP or HSTS.

**Live browser checks** (built app, 375×812 mobile viewport):
- No horizontal page overflow at 375 px (`scrollWidth` = 375).
- Home: exactly 1 `<h1>`; 35 `<img>`, all with `alt`; every in-page `#hash` link has a matching target.
- 26 WhatsApp links on `/`, **all** pointing to `wa.me/923455673921`, all `target=_blank rel=noopener`. `tel:` links: 03435426640, 03009524371, 03455673921.
- Closed mobile drawer: wrapper has `aria-hidden="true"`, yet **13 links/buttons inside it are still focusable** (P1-7, confirmed). The drawer also keeps `role="dialog" aria-modal="true"` while closed.
- Hero video **autoplays on mobile** (`paused === false`).
- Footer "Booking terms" **opens** the terms dialog on `/` (real click) and **does not open** anything on `/gallery` (B2, confirmed by click and code).
- Note: one `Minified React error #327` appeared while scripting clicks in the embedded browser, whose tab reported `visibility: hidden`. It did not recur with real clicks and matches a known React 18 scheduler issue in background tabs. It's recorded as a test-environment artefact, **not** a site defect, but it's worth re-checking on real devices.

**Not tested / could not test:** real phones and Safari/iOS; the WhatsApp hand-off beyond link correctness (opening `wa.me` would leave the site); reduced-motion emulation; Lighthouse/Core Web Vitals scores; video codecs and durations (no `ffprobe` available).

---

## 7. Working features

- Home page renders all sections from typed data; production build succeeds (see §6).
- Desktop nav smooth-scrolls to sections. The mobile drawer opens and closes (button, backdrop, Escape), locks scroll, moves focus to its close button and returns focus on Escape.
- On `/gallery`, hash nav links fall back to `/#section` (`Navbar.go()`).
- **WhatsApp**: every CTA builds a URL-encoded `https://wa.me/923455673921?text=…` link with a context-specific message. All external links use `target="_blank" rel="noopener noreferrer"`.
- **Phone**: `tel:` links for all 3 numbers (Navbar drawer, Location, FinalCta, Footer).
- **Inquiry form**: validates name (≥2 chars), phone (≥10 digits), event type, date (required, not in the past), guest bracket and message (≤500). Shows inline, `aria-invalid`-linked errors; opens WhatsApp with a structured message; shows a summary with "Open WhatsApp Again", "Call" and "Edit details".
- **Menus**: tabs, sheet selector, fullscreen lightbox with ←/→ keys, PDF download.
- **Gallery**: category filters with counts, lightbox with keyboard ←/→, swipe and Escape; home shows 12 photos and links to `/gallery` for all 26.
- **Videos**: poster images until clicked, then native `<video controls>`; error state falls back to the poster.
- **Terms sheet** on `/` (from Menus, BookingForm and Footer).
- **Reduced motion**: global CSS kills animations/transitions; Hero skips JS play() and parallax (with the caveat in §11).
- **SEO basics**: title template, description, OG/Twitter, `EventVenue` JSON-LD, robots, sitemap.
- **Security headers**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`.

## 8. Broken features

| # | Feature | What happens | Evidence |
|---|---|---|---|
| B1 | Booking modal | Can never open. `BookNowButton` (the only caller of `open()`) is not imported anywhere, so `BookingModal` is mounted but unreachable | `grep BookNowButton` shows only its own definition |
| B2 | Footer "Booking terms" on `/gallery` | Clicking does nothing: `openTerms()` sets state, but `GalleryPageClient` does not mount `<TermsSheet />` | `GalleryPageClient.tsx` renders Navbar, Gallery, Footer and WhatsAppButton only |
| B3 | `/gallery` canonical | Inherits `alternates.canonical: "/"` from the root layout, so search engines are told `/gallery` duplicates the home page | `layout.tsx:22-24`; `gallery/page.tsx` sets no `alternates` |
| B4 | `/gallery` `<title>` | `title: "Photo Gallery \| Sadiq Pearl Marquee"` + template `"%s \| Sadiq Pearl Marquee"` gives the brand twice | `gallery/page.tsx:5`, `layout.tsx:11` |
| B5 | Canonical / OG / sitemap / robots / JSON-LD URLs | Point to `https://www.sadiqpearlmarquee.com`, which **does not resolve** (NXDOMAIN, checked 2026-09-29) and is marked `PLACEHOLDER` in code | `layout.tsx:5`, `robots.ts:9`, `sitemap.ts:4` |
| B6 | Inquiry "success" state | Always claims "We opened WhatsApp…". `window.open(..., "noopener")` returns `null` by spec and does not throw when blocked, so the `catch` fallback can never run and a blocked pop-up is not detected | `BookingForm.tsx:113-118` |
| B7 | `npm run lint` | No ESLint config or packages, so `next lint` cannot run non-interactively | see §6 |
| B8 | No-op Tailwind classes | `sm:h-13`, `mt-14 sm:mt-18` and `duration-400` are not in the Tailwind v3 default scale and are not extended, so they generate no CSS (the drawer uses the default 150 ms transition) | `Hero.tsx:157,165`, `About.tsx:130`, `Navbar.tsx:192`; see §6 |

No authentication or booking functionality exists to test.

---

## 9. P0 findings (critical)

| ID | Finding | Location | Why critical |
|---|---|---|---|
| P0-1 | **Placeholder production domain that does not exist** is used for `metadataBase`, canonical, OG URL/images, JSON-LD `url`/`image`, sitemap and robots | `app/layout.tsx:5`, `app/robots.ts:9`, `app/sitemap.ts:4` (hardcoded 3 times, not from config/env) | Any deployment advertises canonical URLs, sitemap entries and share images on a non-existent host. Search indexing and social previews break. |
| P0-2 | **No `.gitignore`** anywhere in the repo | repo root | The next `npm install`/`build` puts `node_modules/` and `.next/` into `git status`. Once Firebase work starts, `.env.local` and service-account JSON can be committed and pushed by accident. Must be fixed before Phase 1 adds any secret. |
| P0-3 | **`npm audit`: `next@14.2.35` is CRITICAL (21 advisories)**, including unauthenticated RCE on Windows-hosted servers (GHSA-p293-qw3h-jr36), RCE/DoS in the Image Optimization API (GHSA-2xp9-vwfh-vxw4, GHSA-h64f-5h5j-jqjh), RSC cache poisoning and Server Actions DoS/SSRF. Bundled `postcss` is HIGH. npm's only fix is `next@16.3.7` (breaking) | `package.json`, `next.config.mjs:4-8` | The live site is exposed now through the image optimizer and RSC. Phase 1 would add middleware, Server Actions and auth on top of a vulnerable framework line. The upgrade (Next 16 + React 19) must be decided, and ideally done as a separate verified step, **before** building new systems. |

## 10. P1 findings (important)

| ID | Finding | Location |
|---|---|---|
| P1-1 | WhatsApp number **duplicated as constants** (`WHATSAPP_RAW/INTL/DISPLAY_NUMBER`) instead of reading `business.whatsappNumber`. `business.whatsappHref` is unused. The display string `"0345 5673921"` is hardcoded in **14 files / about 30 places** (UI text and aria-labels), which contradicts the "do not hardcode" rule in `config.ts:5` | `lib/whatsapp.ts:3-5`, Hero, Navbar, Footer, Location, FinalCta, BookingForm, Events, Menus, Gallery, Highlights, About, Videos, WhatsAppButton, GalleryPageClient |
| P1-2 | Address text "Rashidpur–Orangabad Road / Kakrot / Sarai Alamgir" is repeated as literal copy in about 15 places (Hero, About, Highlights, Location, Gallery, Videos, Reviews, gallery data, metadata) rather than coming from `business.*` | many |
| P1-3 | `/gallery` canonical → `/` (B3) | `app/layout.tsx`, `app/gallery/page.tsx` |
| P1-4 | Footer terms button broken on `/gallery` (B2). More generally, global overlays (TermsSheet, BookingModal) are mounted per page, not in a shared layout | `GalleryPageClient.tsx` |
| P1-5 | **Unresolved business-data conflict** recorded in README: the printed card shows different phone numbers and the address "Nothia Road, Tabbi Tawan". The site uses the GBP details until the client confirms | `README.md` "Open question" |
| P1-6 | **Unconfirmed claims in copy**, against the project's own rule: "Management available daily" (hours unconfirmed); "verified Google reviews from attending families"; "Authentic feedback from families who celebrated wedding ceremonies, receptions…" (reviews say "Average", "Every thing is good"); "Occasion: Lunch / Dine-in" (it's a dining type, not an occasion) | `Videos.tsx:215`, `About.tsx:40`, `Reviews.tsx:18,74` |
| P1-7 | Mobile drawer stays in the tab order when closed. The wrapper gets `aria-hidden` and `pointer-events-none`, but its links and buttons stay focusable, so keyboard and screen-reader users can land on invisible, `aria-hidden` controls | `Navbar.tsx:174-179` |
| P1-8 | ESLint not set up (B7): no automated quality gate before larger phases | `package.json` |
| P1-9 | No tests, no CI, no type-check script | — |

## 11. P2 findings (improvement)

| ID | Finding | Location |
|---|---|---|
| P2-1 | **Hero text flicker**: `animate-fade-in-up` uses `forwards` fill with `delay-100…500` animation delays. During the delay no keyframe applies, so text renders visible, snaps to `opacity:0` when the animation starts, then fades in. Needs `both`/`backwards` fill (later phase) | `tailwind.config.ts:52`, `globals.css:75-91`, `Hero.tsx` |
| P2-2 | Hero video has the `autoPlay` attribute, so it **plays even with `prefers-reduced-motion`**; the JS check only skips the extra `play()` call. It also downloads about 1.1 MB on mobile data | `Hero.tsx:222` |
| P2-3 | Hero parallax calls `setState` on every animation frame during scroll, re-rendering the whole Hero component | `Hero.tsx:34-57` |
| P2-4 | Hero poster `hero-primary.jpg` is **1024×576 (16:9)** but displayed in a **4:5** frame on mobile and desktop. Most of the facade is cropped away and the image is upscaled | `Hero.tsx:202`, asset |
| P2-5 | Gallery `aspect` metadata contradicts the real files: e.g. `royal-stage`, `exterior-daytime-facade`, `interior-chandelier-lobby`, `dessert-buffet`, `dessert-counter`, `exterior-colonnade` and dining photos are **portrait (9:16 or 3:4)** but labelled `landscape`/`square` and rendered in 16:11 or 16:10 crops | `data/gallery.ts`, `Gallery.tsx:170-177`, `Highlights.tsx:103`, `Location.tsx:161` |
| P2-6 | Google Fonts loaded with a `<link>` in `<head>` instead of `next/font`: a render-blocking third-party stylesheet and extra connections, with no self-hosting or size-adjusted fallback | `layout.tsx:88-93` |
| P2-7 | Tabs use `role="tab"`/`tablist` without `tabpanel`, `aria-controls` or arrow-key roving focus. Gallery filters would be better as toggle buttons (`aria-pressed`) | `Menus.tsx:93-146,169`, `Gallery.tsx:118-157` |
| P2-8 | Menus desktop sheet preview is a clickable `<div>` with no role, tabindex or key handler | `Menus.tsx:227-231` |
| P2-9 | Dialogs have no focus trap (Tab leaves the modal) | `useDialog.ts`, Navbar drawer |
| P2-10 | Inquiry success is shown even when WhatsApp didn't open (B6) | `BookingForm.tsx` |
| P2-11 | `Highlights.tsx` reads `highlights[0]`…`[3]` by index, so data edits can crash the section or silently mislabel it | `Highlights.tsx` |
| P2-12 | `Events.tsx` keeps the event→photo map inside the component, not in `data/events.ts` | `Events.tsx:12-37` |
| P2-13 | Missing security headers: no `Content-Security-Policy` or `Strict-Transport-Security` (HSTS may come from the host) | `next.config.mjs` |
| P2-14 | JSON-LD is minimal: no `geo`, `addressRegion`, `sameAs` (TikTok) or `priceRange`. `telephone` uses Line 1 (0343…) while the inquiry line is 0345…. `aggregateRating` on your own LocalBusiness page is not eligible for Google review snippets | `layout.tsx:60-78` |
| P2-15 | `body { overflow-x: hidden }` masks any horizontal-overflow bug instead of fixing it | `globals.css:33` |
| P2-16 | Whole `/gallery` body is a client component; the breadcrumb/header/CTA could be server-rendered | `GalleryPageClient.tsx` |

## 12. P3 findings (minor)

| ID | Finding | Location |
|---|---|---|
| P3-1 | Dead code: `BookNowButton.tsx`, unreachable `BookingModal`, `buildSmsUrl`, `BookingDetails.menu/requests`, `business.whatsappHref`, 7 unused icon paths | various |
| P3-2 | If the modal were ever opened, `BookingForm` would render twice on `/` with duplicate element IDs (`inquiry-name`, etc.) | `BookingForm.tsx` |
| P3-3 | Home gallery "All Highlights" pill shows **26** while the grid shows 12 | `Gallery.tsx:124-127` |
| P3-4 | No-op Tailwind classes `h-13`, `mt-18`, `duration-400` (B8) | Hero, About, Navbar |
| P3-5 | `sitemap.ts` sets `lastModified: new Date()`, which changes every build/request | `sitemap.ts` |
| P3-6 | `BookingContext` holds generic UI state (modal + terms) under a "Booking" name, which will clash with the real booking domain later | `BookingContext.tsx` |
| P3-7 | Heading levels skip (`h2` → `h4`) in Menus, Location and FinalCta | various |
| P3-8 | Phone validation only checks ≥10 digits (no max, no PK format) | `BookingForm.tsx:70` |
| P3-9 | No `apple-touch-icon`, web manifest or high-res favicon (favicon is 64×64) | `public/` |
| P3-10 | OG image is 1024×576 (recommended 1200×630) | `layout.tsx:33-35` |
| P3-11 | `JSON.stringify` output is injected with `dangerouslySetInnerHTML` without escaping `<`. It is safe today (static data) but becomes an XSS vector once the data is admin-editable | `layout.tsx:94-98` |
| P3-12 | No `.nvmrc`/`engines` field to pin the Node version | `package.json` |
| P3-13 | `/gallery` `openGraph` replaces the root object, so `og:url`, `og:site_name`, `og:locale` and `og:type` are missing on that page | `app/gallery/page.tsx` |
| P3-14 | The Terms forbid fireworks, yet a fireworks photo is featured in the gallery ("Celebration Fireworks") | `data/gallery.ts:55-61`, `data/menu.ts:58` |

---

## 13. Security findings

| Area | Status |
|---|---|
| Secrets in client bundle | **None found.** No env vars, keys or tokens anywhere in source |
| Server attack surface | Minimal: no API routes, server actions, middleware, uploads or database |
| User data | The inquiry form keeps data in memory only and hands it to WhatsApp via URL. Nothing is stored or logged by the site |
| External links | All `target="_blank"` links use `rel="noopener noreferrer"` ✅ |
| Headers | nosniff, Referrer-Policy, XFO SAMEORIGIN, Permissions-Policy ✅. **No CSP, no HSTS** (P2-13) |
| Dependencies | **`next@14.2.35` critical (21 advisories), `postcss` high.** Fix requires `next@16.3.7` (P0-3; details in §6). AVIF is disabled as a partial mitigation for GHSA-2xp9-vwfh-vxw4 only |
| Image optimizer | Local images only; no `remotePatterns`, so it cannot be used as an open proxy ✅ |
| Repo hygiene | **No `.gitignore`** (P0-2) |
| JSON-LD injection | Safe now; will need escaping when data becomes dynamic (P3-11) |
| Future Firebase | Nothing exists yet. See §19–20 for the required client/server split |

## 14. Performance findings

- **Good**: 3 runtime deps; `next/image` everywhere with `sizes`; hero poster has `priority`; gallery/section videos mount only on click; WebP output; no animation library or icon font.
- Hero autoplays a **1.1 MB MP4** on every device including mobile data (P2-2); parallax re-renders on scroll (P2-3).
- Google Fonts `<link>` is render-blocking and third-party (P2-6).
- Large JPG sources: the 9 `/images/gallery/*.jpg` files are 450–630 KB each (1200×1600). `next/image` resizes them, but the originals could be recompressed.
- 13 of 21 components are client components (Navbar, Hero, Menus, Gallery, Videos, Footer, BookingForm…). Measured First Load JS: **123 kB on `/`**, 113 kB on `/gallery` (87.3 kB shared). Acceptable, but high for a content-only page.
- `sharp` is not installed, so `next start` warns that production image optimisation uses the slower fallback. Needs attention on whichever host is chosen.
- The hero image preload (`w=750`) triggered a browser "preloaded but not used" warning, because the video fades in over it.
- Home is a single very long page (11 sections, about 40 images; below-the-fold images are lazy by default).

## 15. SEO findings

- Only **2 indexable URLs**. Events, menus, contact and so on are hash sections, so there are no dedicated landing pages for local-intent searches ("wedding hall Sarai Alamgir", "mehndi venue Kakrot", "walima menu"). (Architecture, §19)
- Placeholder, non-resolving domain for every absolute URL (P0-1).
- `/gallery` canonical → `/` (P1-3); duplicated brand in the `/gallery` title (B4).
- JSON-LD minimal (P2-14); OG image under the recommended size (P3-10).
- `lang="en"` with Urdu segments marked `lang="ur" dir="rtl"` ✅. There is one `h1` per page ✅; some heading levels skip (P3-7).
- `robots` allows everything. When a portal/admin is added, those routes need `noindex` and robots exclusions, which the global root layout doesn't allow yet.

## 16. Mobile / responsive findings

- Layout is mobile-aware throughout: stacked grids, `container-px` gutters (20 → 40 → 64 px), tap targets mostly ≥44 px, bottom-sheet-style modals on mobile, safe-area padding on the floating button, touch swipe in the gallery lightbox.
- Header on mobile: logo, WhatsApp icon and hamburger. Drawer is 88% width, max 384 px, with numbered links, a WhatsApp CTA and phone numbers.
- Issues: closed drawer still focusable (P1-7). The hero 4:5 frame crops the 16:9 facade (P2-4). Portrait photos are forced into landscape crops (P2-5). The floating WhatsApp pill overlaps content at the bottom-right (the footer compensates with `pb-24`, but mid-page content can sit under it). The mobile menu section stacks all 3 full sheet images plus 6 buttons, making it very long. The About section keeps its 2-image 7/5 column split at 320 px, so the images and captions become small. `overflow-x: hidden` may hide real overflow (P2-15).
- Tablet (768–1023 px): uses the mobile header/drawer (desktop nav starts at `lg`); most grids are 2 columns.

See §6 for the live browser check results.

## 17. Asset inventory

| Category | Files | Dimensions / size | Notes |
|---|---|---|---|
| **Logo** | `images/logo.jpg` | 324×360, 23 KB | **Photo of physical 3D signage** (green/white "SR"-style mark with a roof line, on grey). No vector, transparent PNG or square version. Its **green** doesn't match the site's gold palette |
| Favicon | `favicon.ico` | 64×64 | No apple-touch-icon or manifest icons |
| **Hero** | `hero/hero-primary.jpg` | 1024×576, 96 KB | Night drone shot of the illuminated facade and signage. Low resolution for a hero |
| **Exterior** | `exterior-aerial-fireworks.jpg` (1024×576, 37 KB), `exterior-colonnade.jpg` (900×1600), `exterior-daytime-facade.jpg` (900×1600) | | Fireworks image is heavily compressed. Note: the Terms say fireworks are prohibited, yet a fireworks photo is featured |
| **Interior / halls** | `interior-aisle` (576×1024), `interior-backdrop-floor` (576×1024), `interior-banquet-full` (1024×576), `interior-chandelier-lobby` (900×1600), `interior-vip-lounge` (576×1024); gallery `crystal-hall`, `chandelier-hall`, `floral-aisle`, `entrance-lobby` (1200×1600) | 118–630 KB | Mostly portrait phone captures; several are low resolution (576 px wide) |
| **Decoration / stage** | `decoration-peacock` (900×1600), `decoration-chandelier-detail` (576×1024), `events/event-stage-arch` (576×1024), gallery `royal-stage`, `chandelier-arch`, `entrance-arch` (1200×1600) | | |
| **Food / menu** | `dining-biryani`, `dining-karahi`, `dining-kheer`, `dining-dessert-display`, `dining-dessert-counter` (900×1600); gallery `dessert-buffet`, `dessert-counter` (1200×1600) | | Captions call them "Special Wedding Biryani" etc. It isn't confirmed that the photos show the venue's own food |
| **Menu card** | `menu/sheet-1..3.jpg` (≈850×1600) + `sadiq-pearl-marquee-menu-card.pdf` (508 KB) | | **Phone photos of the printed card** on patterned fabric, not clean scans. Bilingual English/Urdu, no prices ("Rs. P/h" blank) |
| **Videos** | `hero-exterior.mp4` (1.07 MB), `entrance-tour.mp4` (1.06 MB), `exterior-aerial.mp4` (223 KB) + posters `entrance-tour-poster.jpg` (608×1080, portrait), `exterior-aerial-poster.jpg` (854×480) | | Codec/duration not probed (no ffprobe on this machine). The portrait entrance-tour poster is displayed in a 16:9 frame |
| **Icons** | Inline SVG (`Icon.tsx`) | — | Custom, stroke-based |
| **Fonts** | Google Fonts (remote): Playfair Display, Plus Jakarta Sans | — | Not self-hosted |
| **Backgrounds** | None (CSS colours/gradients only) | — | |

**Assets needed later (not to be invented, must be supplied):**
vector logo (SVG) + square/transparent variants and brand colour confirmation; high-res landscape hero photo/video (≥1920 px); Main Hall photos (empty hall, full setup, day and night); stage/decoration package photos per tier; lighting, flooring, furniture (tables/chairs) options; bridal room; AC/generator (optional); parking/entrance; clean scan or source file of the menu card; per-menu food photos actually from the venue's kitchen; photography/DJ/sound vendor samples if shown; OG share image 1200×630; favicon set / PWA icons; a floor plan and capacity layouts if seating options will be sold.

---

## 18. Existing integrations

| Integration | How | Where |
|---|---|---|
| WhatsApp | `https://wa.me/923455673921?text=…` click-to-chat links | `lib/whatsapp.ts` + every CTA |
| SMS | `sms:` builder exists, **unused** | `lib/whatsapp.ts:73` |
| Phone | `tel:` links | config phones |
| Google Maps | Share link `maps.app.goo.gl/zSqTBqc7MidRtrfe8` (no embed, no API key) | config |
| Google Business Profile | Rating/review data copied manually (static) | config, data/reviews |
| TikTok | Profile link `@sadiq.pearl.marquee` | config |
| Google Fonts | Remote stylesheet | layout |
| Instagram / Facebook | Explicitly `null` (hidden until confirmed) | config |
| Firebase / analytics / email / payments | **None** | — |

---

## 19. Architecture blockers (for the planned system)

Planned: public site + customer portal + admin panel + Firebase Auth / Firestore / Storage + booking engine + availability + services/menus/packages + vendors + payments/receipts + reporting.

**Compatible foundations (no rewrite needed):** Next.js App Router supports route groups, nested layouts, server components, route handlers, server actions and middleware, which are all needed for a Firebase client/server split. TypeScript strict mode and the typed data modules translate directly to Firestore document types. Tailwind tokens can be reused by the portal and admin. The inquiry form's field set (name, phone, event type, date, session, guests, message) is a usable seed for the booking-request model.

| # | Blocker | What will need to change (later, not now) |
|---|---|---|
| A1 | **Single global root layout** carrying public metadata, JSON-LD, fonts and public SEO | Split into a minimal root layout + route-group layouts: `(site)`, `(portal)`, `(admin)`. Portal/admin get `noindex`, their own chrome, and no JSON-LD |
| A2 | **Single-page hash navigation** (`navLinks` are `#…`; `Navbar.go()` assumes hashes; Footer mixes `/#` and `/gallery`) | Introduce real routes for events, menus, packages, services/hall, contact and booking; make nav config route-aware |
| A3 | **No data layer**: all content in TS modules, `config.ts` getters, and hardcoded copy (P1-1, P1-2) | A settings/content model in Firestore (or a hybrid: static build-time content + Firestore for dynamic data) with typed fetchers; centralise the WhatsApp number and address first |
| A4 | **No auth / session / middleware** | Firebase Auth on the client (Google + email/password); a server-verified session (Admin SDK session cookies or ID-token verification) plus middleware/route guards; admin role via custom claims |
| A5 | **No server-side trust boundary** (no route handlers or server actions, no Admin SDK) | All booking creation, status changes, payments and receipts must go through server code using the Admin SDK and Firestore transactions. The client never writes bookings directly |
| A6 | **Slot model mismatch**: site sessions are `Lunch`/`Dinner` (timings deliberately unpublished); the plan is **Day ≈12–5 PM / Night ≈6–11/12 PM**, 2 slots/day, 1 Main Hall | Confirm naming and times with the client; availability keyed on `date + hall + slot`, with a unique slot-lock document per key to prevent double booking |
| A7 | **Guest count is a bracket string** (`"250 – 500 Guests"`) | Numeric guest count validated against capacity (planned 1,000, currently unpublished and unconfirmed) and the Terms minimum (300 guests + Rs 300/head surcharge below that) |
| A8 | **Pricing rules exist only as prose** in Terms: 5% service charge, AC Rs 20,000/hour, extra time Rs 20,000/hour, min 300 guests (+Rs 300/head), non-refundable advance, extra decoration/lighting/sound charged separately. **No per-head menu prices anywhere** | Configurable pricing model (per-person menu rates, hall rent, service line items, surcharges, tax, service %) stored as integer PKR. All numbers must come from the client |
| A9 | **Timezone**: dates are computed in the browser's local time (`todayString()`) | Canonical `Asia/Karachi` business dates on the server |
| A10 | **Media in `/public` only** | Admin-managed gallery/menus/packages need Firebase Storage + `images.remotePatterns` + Storage rules |
| A11 | **Hosting target undefined**; the site needs a Node runtime | Decide Vercel vs Firebase App Hosting (and region) before auth work. Server Admin SDK credentials must live only in host secrets |
| A12 | **Framework version**: Next 14.2 + React 18 with known advisories (P0-3) | Decide whether to upgrade to the current Next major (and React 19) **before** building new systems, as a separate, verified step |
| A13 | **No validation/schema library, lint, tests or CI** | Add schema validation (shared client/server), ESLint, a type-check script and a minimal test and CI baseline |
| A14 | `BookingContext` naming and page-level overlay mounting | Move shared overlays into the site layout; rename UI context |
| A15 | **Receipts/quotations/reports** need document generation and number sequencing | Server-side PDF generation and transactional counters (later phase) |
| A16 | **WhatsApp**: currently click-to-chat only | Manual click-to-chat with pre-filled templates from admin/portal works without new infrastructure. Automated messaging would need the WhatsApp Business Platform, a separate decision |

---

## 20. Recommended architecture direction

(Direction only. Nothing is implemented in Phase 0.)

1. **Keep** the existing Next.js App Router + TypeScript + Tailwind project; evolve it, don't rebuild it. Treat framework upgrade (A12) as its own small, verified step.
2. **App structure**: `app/(site)/…` for the public site, `app/(portal)/account/…` for customers, `app/(admin)/admin/…` for staff, each with its own layout. A minimal root layout.
3. **Firebase split**:
   - *Client SDK*: Auth UI (Google + email/password) and reads the Security Rules allow (a customer's own profile and bookings, public content).
   - *Admin SDK (server only)*: session verification, booking creation, approvals, slot locking (transactions), payments, receipts, reports. Credentials only in host secret storage, never `NEXT_PUBLIC_*`.
   - *Security Rules*: deny by default; customers read and write only their own profile and read their own bookings; bookings, payments and slots are server-written only; admin by custom claim.
   - *Storage*: public read for published media; admin-only write; private paths for receipts.
4. **Data model sketch** (for Phase 1 planning, not to create yet): `settings/business` (replaces `config.ts` facts), `halls`, `slots` definitions, `services`, `menus`, `packages`, `vendors`, `customers`, `bookings`, `slotLocks/{date_hall_slot}`, `payments`, `receipts`, `quotations`, `auditLog`. Money as integer PKR; dates as `YYYY-MM-DD` in Asia/Karachi.
5. **Content**: migrate the **existing verified content** (menus, terms, reviews, gallery captions, config facts) into the new model as its initial data. It's real data, not fake. Everything unconfirmed stays empty or hidden until the client supplies it.
6. **Public site stays fast**: server components by default, static/ISR for public content, client islands only where interaction is needed; `next/font` for self-hosted fonts.
7. **Quality gates**: ESLint, `tsc --noEmit`, a schema validation library, basic tests for booking/pricing logic, CI on push.

---

## 21. Phase 1 prerequisites

**Repository / tooling**
1. Add a `.gitignore` (`node_modules`, `.next`, `.env*`, `*.pem`, service-account JSON, Firebase debug logs). (P0-2)
2. Decide the Next.js/React upgrade, and whether it happens at the start of Phase 1. (P0-3, A12)
3. Configure ESLint so `npm run lint` runs non-interactively; add a type-check script.
4. Pin the Node version (`engines` / `.nvmrc`).

**Decisions / information needed from the client or owner**
5. **Production domain** (P0-1) and **hosting target + region** (A11).
6. Resolve the **phone/address conflict** between the printed card and GBP (P1-5).
7. Confirm **hall name**, **capacity (1,000?)**, **slot names and exact times** (Day/Night vs Lunch/Dinner), and whether multiple halls may ever exist.
8. Confirm the **pricing inputs**: per-head rate per menu, hall rent, each service's price and unit (decoration, stage, lighting, flooring, tables/chairs, photography, DJ/sound, AC, generator, bridal room), tax, service %, advance %, cancellation/refund policy (the Terms say the advance is non-refundable).
9. Confirm **opening/office hours** (currently unpublished) and which WhatsApp number(s) handle bookings versus general inquiries.
10. List of **admin/staff users and roles** (owner, manager, accountant?).
11. **Firebase projects**: separate dev and prod projects, created and owned by the business account; billing plan; the auth providers to enable.
12. Supply the missing **assets** listed in §17.

---

## 22. Files that should be preserved

| File | Reason |
|---|---|
| `public/**` (all images, videos, menu sheets, PDF, favicon) | The only real venue media; referenced by verified data |
| `src/data/menu.ts` | Accurate transcription of the printed menu card + translated Terms (checked against sheet 1) |
| `src/data/reviews.ts` | Verbatim GBP reviews |
| `src/data/gallery.ts` | Captions/titles of real media (fix `aspect` values later) |
| `src/data/highlights.ts`, `src/data/events.ts` | Confirmed/placeholder content with status labels |
| `src/lib/config.ts` | Canonical list of confirmed business facts and their status annotations; source for the future settings model |
| `README.md` | Content-status record (CONFIRMED / unconfirmed / open question) |
| `tailwind.config.ts`, `src/app/globals.css` | Design tokens and base styles to keep |
| `src/components/Icon.tsx` | Dependency-free icon set |
| `next.config.mjs` | Security headers and AVIF mitigation (extend, don't drop) |
| `src/components/Section.tsx`, `useDialog.ts` | Small reusable primitives |

## 23. Files that may require modification later

| File | Expected change (later phases) |
|---|---|
| (new) `.gitignore` | Create before Phase 1 (P0-2) |
| `package.json`, `package-lock.json` | Upgrade path, lint/test deps, Firebase SDKs, scripts, `engines` |
| `src/app/layout.tsx` | Split into root + `(site)` layout; domain from config/env; `next/font`; JSON-LD escaping and enrichment |
| `src/app/page.tsx` | Move into `(site)`; shared overlays to layout |
| `src/app/gallery/*` | Own canonical, fixed title, mount TermsSheet via layout, server-render the shell |
| `src/app/robots.ts`, `src/app/sitemap.ts` | Real domain; new routes; disallow portal/admin |
| `next.config.mjs` | `images.remotePatterns` for Storage; CSP/HSTS |
| `src/lib/config.ts` | Becomes a static fallback or seed for Firestore `settings` |
| `src/lib/whatsapp.ts` | Use the configured number; remove duplicate constants; templates for admin/portal |
| `src/components/Navbar.tsx`, `Footer.tsx` | Route-aware navigation; account/login entry; drawer a11y fix |
| `src/components/BookingForm.tsx`, `FinalCta.tsx` | Evolve into a real booking request (date + hall + slot + numeric guests) with availability check; keep the WhatsApp hand-off as an option |
| `src/components/BookingContext.tsx`, `BookingModal.tsx`, `BookNowButton.tsx` | Rename/wire or remove |
| `src/components/Hero.tsx` | Flicker fix, reduced-motion video, remove per-frame setState, better hero asset |
| `src/components/Menus.tsx`, `Events.tsx`, `Highlights.tsx`, `Gallery.tsx`, `Videos.tsx`, `Reviews.tsx`, `About.tsx`, `Location.tsx`, `WhatsAppButton.tsx` | Read from the data layer instead of hardcoded strings; a11y fixes; copy-accuracy fixes (P1-6) |
| `tailwind.config.ts` | Add missing scale values or remove no-op classes; tokens for portal/admin |

---

## Design baseline (reference)

**Palette** (`tailwind.config.ts`): surface `#fcf9f5` / low `#f6f3ef` / mid `#f0edea` / high `#ebe8e4` / highest `#e5e2de`; ink `#1c1c1a` / soft `#4e4638` / muted `#645d54`; gold `#795916` / container `#b8914a` / light `#ebc074` / pale `#ffdea9`; line `#d2c5b3` / strong `#807667`; night `#31302e`. Selection is gold-container on white. Warm ivory with antique gold; light theme only (no dark mode). **Logo green is not in the palette.**

**Typography**: Playfair Display (display/headings, some italic taglines) + Plus Jakarta Sans (body/UI). Eyebrows are 10–11 px, uppercase, tracking 0.14–0.18em, gold. Section H2 is 30/38 → 40/50 px. Hero H1 is 30 px (mobile) → 62 px (xl).

**Spacing / layout**: `max-w-content` 1320 px; `container-px` gutters 20/40/64 px; sections `py-16 md:py-24`; 12-column grids at `lg`; card padding 24–40 px.

**Radii**: DEFAULT 2 px, lg 4 px, xl 8 px. Components also use Tailwind's default `rounded-2xl`/`rounded-full`, so radii are inconsistent (buttons mix `rounded` 2 px, `rounded-lg`, `rounded-xl` and `rounded-full`).

**Buttons**: primary is solid gold with white text, h-11/h-12, often with the WhatsApp glyph and sometimes uppercase. Secondary is a gold or line outline. Pills are rounded-full filters. Many near-duplicate class strings; there is no shared Button component.

**Cards**: `bg-surface`, `border-line/70`, `rounded-2xl`, `shadow-sm`, gold border on hover, image zoom on hover (scale-105, 700 ms).

**Header**: fixed, translucent ivory with backdrop blur, compacts on scroll; logo tile + "SADIQ PEARL / Marquee · Sarai Alamgir"; desktop links at `lg+`; hamburger + WhatsApp icon below `lg`.

**Hero**: two-column (text 7/12, media 5/12). Eyebrow badge, H1 brand name, italic tagline, paragraph, rating/amenity chips, 2 CTAs, microcopy. Media is a 4:5 framed video over a poster with gradient, location badge, "Real Venue" badge and caption.

**Sections**: alternate ivory tones separated by hairline borders. Order: About → Features → Events → Menus → Gallery → Videos → Reviews → Contact → Inquiry.

**Footer**: dark `night` background, 4 columns (brand + rating, nav + terms, contacts, address + Maps).

**Animations**: fade-in-up/scale-in on hero load, hover zooms, drawer slide, floating-button entrance + ping dot, pulse dots, desktop hero parallax (≤24 px). Reduced-motion handled in CSS. **No 3D/WebGL.**

**Preserve**: warm ivory + antique gold identity, Playfair/Jakarta pairing, editorial card language, content honesty (no invented facts), WhatsApp-first contact, Urdu labels, real photography only.

**Redesign later**: brand-colour alignment with the logo (or confirm gold is intended), a single Button/Card component system, consistent radii, hero composition (a wider asset or a full-bleed layout), crops that respect photo orientation, a shorter mobile menu section, dedicated pages instead of one long scroll, and portal/admin UI built on the same tokens.

---

## Change control (Phase 0)

- **Files created:** `sadiq-pearl-marquee/SADIQ_PEARL_PHASE_0_AUDIT.md` (this report).
- **Files modified:** none. No source, config, asset or dependency changes were made.
- **Repo state after audit:** `git status` shows only this report as untracked. Install, build, lint and serve all ran on a disposable copy outside the repo, which was deleted afterwards, so no `node_modules/` or `.next/` was created in the project.
- **Work deliberately not done:** no fixes, no `.gitignore`, no upgrades, no Firebase, portal, admin or booking code, no redesign. Those wait for explicit Phase 1 instruction.
