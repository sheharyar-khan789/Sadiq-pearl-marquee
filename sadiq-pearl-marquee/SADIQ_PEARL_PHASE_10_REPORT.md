# Sadiq Pearl Marquee — Phase 10 Report
## SEO / Content / Gallery / Reviews (+ Phase 9 regression verification)

Everything below states what was actually run. **Firestore emulator verification is still NOT EXECUTED — ENVIRONMENT BLOCKER** (§15).

---

## 1. Phase 9 regression verification

Phase 9 left 4 browser checks open. They were re-run before any Phase 10 change was relied on. The machine was **not idle**: CPU stayed at 95–100%, mostly from about 27 `git` processes of the Claude desktop app scanning the home-directory repository (`C:\Users\sheharyar` is itself a git repo). Those were not stopped, because they are not project processes.

| Run | Harness changes | admin-panel | ops |
|---|---|---|---|
| Phase 9 full suite | 2.5 s fixed navigation wait | 59/68 | 54/59 |
| Phase 9 busy re-run | + waits for page load, `<main>` and hydration | 65/68 (the 3 open) | 58/59 (the 1 open) |
| Phase 10 isolated re-run 1 | same | **67/68**: only "Cancellation approved" | **59/59** |
| Phase 10 diagnostic re-run | + diagnostics on that check | 65/68 (different checks) | — |
| Phase 10 re-run 3 | + condition waits after approve (below) | 66/68: the 4 originally open checks **all pass**; 2 *other* calendar checks failed | 58/59: a *different* check failed |

**Root cause of the one check that kept failing** ("Cancellation approved: booking Cancelled, slot released"). A focused reproduction (`cancel-repro.mjs`) logged the page every second after approving:

- the API returned **200**, and the "cancellation was approved" notice appeared within ~1 s;
- the slot was released at once (server state correct);
- the page showed **"Cancelled" after ~15.4 s**. This is `router.refresh()` re-rendering the server page; a direct server render of that page took 3.6–6.5 s on the loaded machine;
- the old check paused a **fixed 1.5 s** after the notice, then read the page.

**Classification:**

| Item | Classification |
|---|---|
| "Cancellation approved…" and "Approved: booking moved…" (admin) | **test synchronisation + environment performance**; not an application regression |
| "Modification review shows…" (admin), "Status moved to Preparing" (ops) | same pattern (page read before the refresh / hydration finished) |
| Calendar / list / internal-note checks failing in single runs | **environment flakiness**: a different set failed in each run, and each passed in other runs |

**Test-only changes (no assertion weakened):**

- `admin-panel-e2e.mjs`: after "change approved" / "cancellation approved", wait (≤ 30 s) for the refreshed page to show the result, instead of a fixed 1.5 s pause.
- `ops-e2e.mjs`: the existing wait for the refreshed status went from 8 s to 30 s.
- `portal`, `admin-panel`, `settings`, `finance`, `ops` harnesses (`patch-waits.mjs`): navigation waits for load, `<main>` and hydration instead of a fixed 2.5 s, and clicks wait until the target element is hydrated.
- `run-regress.mjs`: the server-start wait went from 60 s to 180 s (the first render took over a minute under load).

**No Phase 9 application code was changed.**

## 2. Production build result

The normal production build, `NEXT_TELEMETRY_DISABLED=1 npx next build`, was run at the end of this phase. No emulator variables were set and no test server was running.

- It finished with **Success (exit 0)**: compiled in 6.8 s, TypeScript passed, and 35/35 static pages were generated.
- `/robots.txt`, `/sitemap.xml` and `/gallery` are static. `/reviews` is dynamic.
- The log has **0** lines matching error, credential or TimeoutError. The "config load failed" / "default credentials" noise seen in the emulator-wired *test* builds does not appear in this production build.

The emulator-wired test build also succeeded (§14).

## 3. SEO implementation

**Indexable pages:**

| Page | Title | Canonical | OG / Twitter | Breadcrumb |
|---|---|---|---|---|
| `/` | "Sadiq Pearl Marquee \| Wedding & Event Venue in Sarai Alamgir" | `/` | yes | — |
| `/gallery` | "Photo Gallery \| Sadiq Pearl Marquee" | `/gallery` | yes (real stage photo) | Home › Gallery (visible + JSON-LD) |
| `/reviews` (new) | "Guest Reviews \| Sadiq Pearl Marquee" | `/reviews` | yes | Home › Reviews (visible + JSON-LD) |
| `/book` | existing title | `/book` (all `?date=` variants) | **added** | — |

- **Page structure:** each indexable page has one `<h1>` (tested).
- **Descriptions:** factual, from the existing confirmed business information. No keyword stuffing.
- **Private and utility pages send `noindex`:** account, admin and auth layouts (unchanged), and the 404 page (Next.js default).

**Canonical domain:**
- Uses the existing configured `siteUrl` (`https://www.sadiqpearlmarquee.com`, still marked PLACEHOLDER in `src/lib/config.ts`).
- **The production domain is still required.** It can now be set without code changes through `NEXT_PUBLIC_SITE_URL`, which must be a valid `https://host`; anything else falls back to the configured value.
- No domain was invented.

## 4. Metadata architecture

`src/lib/seo.ts` is the single place for:

| Helper | Purpose |
|---|---|
| `pageMetadata({title, description, path, image?})` | canonical, Open Graph and Twitter for one page |
| `baseOpenGraph`, `DEFAULT_OG_IMAGE` | shared fields; the default image is the real night facade photo |
| `venueJsonLd()`, `websiteJsonLd()`, `breadcrumbJsonLd()`, `jsonLdHtml()` | structured data; `<` is escaped |
| `PRIVATE_PATHS` | paths blocked in robots.txt |

- The root layout keeps the title template, `metadataBase` and default description.
- `/`, `/gallery`, `/book` and `/reviews` use `pageMetadata`; duplicated per-page metadata objects were removed.

## 5. Sitemap

`src/app/sitemap.ts` lists only the stable public pages:

- `/`
- `/gallery`
- `/reviews`
- `/book`

It never includes admin, account, auth, API, booking records or query strings (tested).

## 6. Robots

`src/app/robots.ts`:

- `Allow: /`
- `Disallow:` `/admin`, `/account`, `/api/`, `/login`, `/signup`, `/forgot-password`, `/auth/`
- `Sitemap:` link and `Host:`

There is one implementation; the site is not blocked as a whole.

## 7. Structured data

**On public pages (site layout):** `EventVenue` (name, URL, image, logo, the 3 configured phone numbers, street address, locality, country, Google Maps link, configured TikTok profile) and `WebSite`.

**Breadcrumbs:** `BreadcrumbList` on `/gallery` and `/reviews`, matching the visible breadcrumbs.

**Removed:**
- **`aggregateRating`** (Google's 4.4 from 8 reviews). Those are third-party Google ratings; marking them up as the venue's own rating is not appropriate.
- `addressRegion: "Punjab"`, which was not in the project's configured data.

**Omitted on purpose:** opening hours, price range, coordinates, awards and review markup. No review schema is emitted, because Google treats reviews a business collects about itself as self-serving.

## 8. Content architecture

- **No second CMS.** Services, menus, packages and event types stay in the business configuration (Phase 6). No SEO data file duplicates them.
- **Internal links added:**
  - Home reviews section → `/reviews`;
  - footer → "Guest reviews";
  - `/reviews` → booking page and Google reviews (existing official Maps link).
  - Existing links (Gallery, Book, WhatsApp) are unchanged.
- **Home "Reviews" section:** still shows the **verbatim, attributed Google reviews** and the Google rating (CONFIRMED in `src/data/reviews.ts`, captured 2026, with the official "Read all reviews on Google" link). It is visibly labelled as Google's. Nothing was added to it.

## 9. Gallery changes

The existing gallery (real Sadiq Pearl photos only, categories, accessible lightbox with ←/→ and Escape, focus restore, `next/image` with true dimensions and responsive `sizes`) was kept. The changes:

- **Alt text:** gallery tiles now use the real caption, e.g. "Biryani — Aromatic basmati rice prepared for banquet table service." instead of only "Biryani". This is a natural description, not keyword strings.
- **Venue films:** the real stage and entrance films (`DecorReels`) are now also on `/gallery`. They use `preload="none"`, a poster image, play only when on screen, are muted, respect reduced motion, and have accessible play/pause buttons.
- **No new media, no stock or downloaded images.**

## 10. Review system

**Collection:** `reviews/{rv_<sha256(bookingId)>}`, at most **one review per booking**.

| Field | Meaning |
|---|---|
| `bookingId`, `customerId` | the reviewed booking and its owner |
| `displayName` | chosen by the guest, 2–60 characters |
| `rating` | integer 1–5 |
| `text` | 10–1000 characters |
| `eventTypeLabel` | snapshot from the booking |
| `status` | pending / approved / rejected |
| `createdAt`, `updatedAt`, `publishedAt` | timestamps |
| `moderation` | `{by, at, note}`; the note stays internal |
| `revision` | number of guest edits |

**Eligibility rule** (the safest minimal rule, since no business rule was defined):
- the signed-in customer must **own** the booking, and the booking status must be **completed**;
- identity and ownership come from the session and the stored booking, never from the request.

**Submission:**
- From `/account/bookings/{id}` (section shown only for completed bookings), through `POST /api/account/bookings/{id}/review`: same-origin, session, rate-limited (10/min), allow-listed fields.
- A second submission **edits** the same review and sends it back to moderation (`revision`+1); an approved review leaves the public page until it is re-approved.

**Aggregates** (count, average to 1 decimal, 1–5 distribution) are computed from approved reviews only. With none, no aggregate is shown.

## 11. Review moderation

- **`/admin/reviews`** (Super Admin only, in the admin navigation): Waiting / Published / Rejected tabs, a search, and Approve & publish / Reject (or Unpublish) behind a confirmation with an optional internal note.
- **`POST /api/admin/reviews/{id}`:**
  - uses `adminMutation` (same-origin, session, `super_admin` claim, verified email);
  - a stale check stops it if the guest edited in between;
  - `revalidatePath("/reviews")`.
- **Audit:** `review_approved` / `review_rejected` (entityType `review`) in `adminAudit`, **without** the review text.
- **Public `/reviews`:** approved only. Empty state: "Reviews from our guests will appear here." An error state is shown when reviews can't be loaded.

## 12. Security

- **Rules:** `reviews/{id}` is `allow read, write: if false` (server-authoritative), with 5 new rules tests (82 in total):
  - a customer can't self-approve, write directly, edit another review or delete;
  - nobody can read reviews from the browser.
- **API:**
  - unauthenticated → 401; cross-site → 403;
  - another customer's booking → 404; not completed → 409;
  - client `status` or out-of-range rating → 400;
  - a customer can't moderate (403) or open `/admin/reviews` (404).
- **Public review view** carries no customer ID, booking ID or moderation note (tested).
- **Earlier phases unchanged:** booking ownership, admin authorisation, finance, operations and notifications were not modified (regression suites, §14).

## 13. Tests

| Test | Content |
|---|---|
| `tests/booking/reviews.test.ts` (in-memory, 4 tests) | validation; eligibility (own + completed); one per booking; edit → pending; moderation incl. stale / already decided; audit without text; public view hides IDs and note; aggregates from approved only |
| `tests/firestore/reviews.firestore.test.ts` (emulator) | the same flow on the real Firestore adapter (blocked, §15) |
| `p10-e2e.mjs` (54 checks; real server, memory store, Auth emulator, headless Chrome) | robots; sitemap; per-page metadata, canonical, OG, Twitter, one h1; query-variant canonical; noindex on auth pages; private routes; 404 noindex; structured data (facts only, no rating / hours / price / geo, breadcrumb matches); reviews end-to-end (empty state, 401/403/404/409/400, pending hidden, admin approve, approved shown, aggregate, no leaks, edit → pending); gallery (only own images, descriptive alt, films preload none / muted / labelled, lightbox dialog, ←/→, Escape + focus return, `aria-pressed` filters); customer review section; 320–1280 px (no overflow, one h1, alt present, lightbox fits) |

## 14. Exact test results

Environment: Windows 11, Node 24.18, Next.js 16.3.7; CPU at 95–100% throughout (see §1).

| Command / harness | Environment | Result |
|---|---|---|
| `npx tsc --noEmit -p .` | static | **0 errors** |
| `npx eslint src tests` | static | **0 errors**, 0 warnings |
| `npm run test:booking` | in-memory | **199/199** (4 new review tests) |
| `npx next build` (emulator-wired test env) | build | **Success** |
| `p10-e2e.mjs` (Phase 10) | real server, memory store, Auth emulator, headless Chrome | **54/54** |
| Final regression suite | see below | **all harnesses pass** (portal and ops after an isolated re-run, below) |
| `npx next build` (production env) | build | **Success** (exit 0): compiled in 6.8 s, TypeScript OK, 35/35 static pages; **0** error / credential / timeout lines in the log |

**Final regression suite.** Each harness was run against a fresh test server in its own mode (`run-regress.mjs`).

| Harness | Result |
|---|---|
| portal-e2e | full suite: crashed (headless Chrome did not start within 18 s under load); **isolated re-run: 89/89** |
| admin-panel-e2e | **68/68** |
| settings-e2e | **44/44** |
| finance-e2e | **56/56** |
| ops-e2e | full suite: 58/59 ("Internal note added via the UI"); **isolated re-run: 59/59** |
| comm-e2e (Phase 9) | **49/49** |
| p10-e2e (Phase 10) | **54/54** |
| booking-api (server up) | **21/21** |
| booking-ui | **31/31** |
| admin-e2e | **9/9** |
| auth-e2e | **25/25** |
| reset-e2e | **26/26** |
| logout-check | **ok** |
| booking-api (Firestore down) | **23/23** |
| portal-failure | **8/8** |
| admin-failure | **6/6** |
| inquiry-failure | **3/3** |

**Harness-only changes for the two re-runs (no assertion changed):**
- `portal-e2e.mjs` and `ops-e2e.mjs`: the Chrome start-up wait loop went from 60 to 200 iterations.
- `ops-e2e.mjs`: the wait for the internal note to appear went from 8 s to 30 s.

These are both environment-load issues of the same kind as §1, not application regressions.

**Fixes made while running `p10-e2e.mjs`:**
- **App:** gallery alt text made descriptive (above).
- **Harness, selectors only:**
  - the lightbox selector had matched the site menu dialog;
  - the opener selector had matched the "Book Your Event" button;
  - the alt-check threshold was adjusted.

## 15. Firestore verification status

| Command | Result |
|---|---|
| `npm run test:booking:firestore` (engine, admin, finance, immutability, operations, notifications, reviews) | **NOT EXECUTED — ENVIRONMENT BLOCKER.** `Firestore Emulator has exited with code: 1`; `firestore-debug.log`: `io.netty.channel.ChannelException: failed to open a new selector` |
| Rules (`firebase emulators:exec --only firestore … "node scripts/test-security-rules.mjs --only=firestore"`; `npm run test:rules` needs port 9099, used by the running Auth emulator) | **NOT EXECUTED — ENVIRONMENT BLOCKER**, same error |

- **Cause:** unchanged since Phase 7. Java's `Selector.open()` loopback pipe is refused in this agent's sandbox.
- **No Firestore claim:** in-memory results are not Firestore results.
- **To run them** (your own terminal, JDK 21+):
  ```
  npm run test:rules
  npm run test:booking:firestore
  ```

## 16. Changed files

**New**
- `src/lib/booking/reviews.ts`
- `src/lib/booking/reviews-server.ts`
- `src/app/(site)/reviews/page.tsx`
- `src/app/(admin)/admin/reviews/page.tsx`
- `src/app/api/account/bookings/[bookingId]/review/route.ts`
- `src/app/api/admin/reviews/[reviewId]/route.ts`
- `src/components/account/ReviewForm.tsx`
- `src/components/admin/ReviewModeration.tsx`
- `tests/booking/reviews.test.ts`
- `tests/firestore/reviews.firestore.test.ts`
- `SADIQ_PEARL_PHASE_10_REPORT.md`

**Modified**
- `src/lib/seo.ts`: metadata and structured-data helpers, private paths
- `src/lib/config.ts`: `NEXT_PUBLIC_SITE_URL` override
- `src/app/robots.ts`
- `src/app/sitemap.ts`
- `src/app/(site)/layout.tsx`: structured data, no `aggregateRating`
- `src/app/(site)/page.tsx`
- `src/app/(site)/gallery/page.tsx`: metadata, breadcrumb JSON-LD, venue films
- `src/app/(site)/book/page.tsx`: OG / Twitter
- `src/components/Gallery.tsx`: alt text
- `src/components/Reviews.tsx`: link to `/reviews`
- `src/components/Footer.tsx`: link
- `src/components/admin/AdminNav.tsx`: Reviews
- `src/app/(account)/account/bookings/[bookingId]/page.tsx`: review section
- `src/lib/booking/store.ts`
- `src/lib/booking/firestore-store.ts`
- `src/lib/booking/testing/memory-store.ts`
- `src/lib/booking/audit-model.ts`
- `firestore.rules`
- `scripts/test-security-rules.mjs`
- `README.md`

**Deleted:** none.

**Test harnesses** (outside the repository, in the agent's temp folder): `p10-e2e.mjs`, `review-seed.ts` and `cancel-repro.mjs` are new; `admin-panel-e2e.mjs`, `ops-e2e.mjs`, `portal-e2e.mjs`, `settings-e2e.mjs`, `finance-e2e.mjs` and `run-regress.mjs` received the synchronisation changes in §1.

## 17. Dependencies

**None added.**

## 18. Known limitations

- **Firestore emulator verification** is still blocked (§15).
- **Canonical domain** is a placeholder until the real domain is set (`NEXT_PUBLIC_SITE_URL`).
- **Review eligibility** is "own + completed booking". Guests without an online account (walk-ins) can't review online.
- **Google review snapshot:** the home page's Google rating and reviews are a captured snapshot (2026), not live. Google review integration is not configured.
- **Build-log noise:** the emulator-wired *test* build logs "config load failed / Could not load the default credentials" during static generation (also seen since Phase 9; not in Phase 8). The build succeeds, and it only appears in the test environment, which has emulator variables but no credentials. The production-env build has no Firebase configuration. The page that triggers the lookup was not identified.
- **Urdu PDF font:** a licensed font is still required.

## 19. Business information still required

- Production domain.
- Real prices, advance rule, refund and other policies.
- Confirm or remove the printed-card surcharge and service charge.
- Vendor details.
- Slot timings.
- A licensed Urdu font.
- Optional: any further official social profiles (only TikTok is configured), so they can be added to `sameAs`.
- Optional: confirmation of whether the Google rating snapshot should be refreshed.

## 20. Deferred to Phase 11 / 12

- Final security audit, final performance audit and load testing.
- Real Firestore / production verification.
- Deployment, domain and DNS setup.
- Production launch.

No commits were made.
