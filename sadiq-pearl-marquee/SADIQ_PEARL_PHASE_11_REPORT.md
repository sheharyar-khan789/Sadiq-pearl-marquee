# Sadiq Pearl Marquee — Phase 11 Report
## Final Security / Testing / Performance Audit (production hardening, no new features)

Date: 2026-10-02.

Environment:
- Windows 11, Node 24.18.1, JDK 25 (`JAVA_HOME`), Chrome headless.
- Next.js **16.3.8** (upgraded from 16.3.7 in this phase), React 19.3.0, Firebase JS 12.19.0, firebase-admin 14.5.0.

Test categories are kept separate throughout this report:

| Category | Meaning |
|---|---|
| **in-memory** | the real application logic running on the in-memory transactional test store |
| **Auth emulator** | real sessions from the Firebase Auth emulator, with a real `next start` server |
| **real Firestore** | the Firestore emulator. **NOT EXECUTED** in this phase; see §23 |

---

## 1. Executive summary

- **No Critical and no High issue was found.**
- The audit covered the source code, the rules, the configuration and the dependencies. It also attacked the running server with direct HTTP requests. A new 77-check security harness covers:
  - unauthenticated, cross-customer, customer-to-admin and cross-site requests;
  - forged, tampered, revoked and disabled sessions;
  - mass assignment, malformed input, stored XSS, rate limits, headers, CORS, error leakage and SEO privacy.
- **Hardening done (all small, all regression-tested):**
  - Next.js patch upgrade 16.3.7 → 16.3.8, the September 2026 security release.
  - Added a narrow Content-Security-Policy, HSTS on production builds, and removed the `X-Powered-By` header.
  - Production builds now warn loudly when `NEXT_PUBLIC_SITE_URL` (the production domain) is missing. It is now documented in `.env.example`.
  - Screen readers now announce field validation errors (`role="alert"`) on the auth, booking-request and change-request forms.
  - The unused Firebase Storage SDK was removed from the browser bundle.
  - Fixed a **flaky unit test** (`reviews.test.ts`, a test defect: it failed about 50% of runs).
- **Results:**
  - 199/199 unit tests.
  - All 20 E2E harnesses pass, in one full run with no reruns (§22).
  - Storage rules 3/3 on the Storage emulator.
  - `npm run build` succeeds.
- **Firestore emulator verification: NOT EXECUTED — ENVIRONMENT BLOCKER**, the same `failed to open a new selector` error as before (§23).
- **Not launched.** The production domain and other business configuration are still required (§29).

## 2. Phase 9 regression verification

Phase 9's open browser checks were in admin-panel (approve / cancel refresh, modification review) and ops ("Status moved to Preparing").

They passed in the **single full regression run** of this phase, against the Phase 11 build:

| Harness | Result |
|---|---|
| admin-panel-e2e | **68/68** |
| ops-e2e | **59/59** |
| comm-e2e (notifications, WhatsApp) | **49/49** |

No test was rerun or modified for this.

## 3. Phase 10 regression verification

- `p10-e2e`: **54/54** (SEO, structured data, reviews end-to-end, gallery, lightbox, 320–1280 px).
- **Defect found in a Phase 10 unit test.** `tests/booking/reviews.test.ts` "public view … aggregates" failed in **2 of 5** isolated runs.
  - Cause: the test looked for the customer uid `"c0"` inside the public JSON. The public JSON carries `reviewId` = `rv_` + a random 64-hex hash, and `"c0"` appears in random hex about half the time.
  - It was a **test** defect, not an application leak: no uid is in the public view.
  - Fix: the test uids became `guest-uid-N` (letters outside hex), and the leak check now looks for `"guest-uid"`. This makes the check *stricter*, and it can no longer pass or fail by chance.
  - Result: **15/15** repeated runs passed, then the full suite **199/199**.
  - Phase 10's reported 199/199 was a real run that happened not to hit the collision.

## 4. Authentication audit

| Item | Finding | Evidence |
|---|---|---|
| Session cookie | `__session`: **HttpOnly, SameSite=Lax, Secure** (production server), Path=/, Max-Age 432000 (5 days) | p11-security, Set-Cookie checks |
| Session minting | requires a same-origin request + a valid ID token + sign-in within 5 min (or refreshing the same user's valid session) | code (`api/auth/session`); forged unsigned token → 401; cross-site → 403 |
| Server verification | every protected layout and API verifies the cookie with the Admin SDK (`verifySessionCookie(..., checkRevoked=true)`). The proxy is only an optimistic redirect | forged cookie → sign-in; tampered real cookie → sign-in |
| Revocation / logout | sign-out revokes refresh tokens. A **copied** cookie is rejected after sign-out (page → sign-in, API → 401) | p11-security §9; logout-check (3 timing gaps, all REJECTED) |
| Disabled account | an existing session of a disabled user is rejected | p11-security |
| Expired session | enforced by Firebase `verifySessionCookie` (exp claim). **Not reproduced live**: it would need a 5-day wait or clock manipulation | code review |
| Admin role | only from the server-set custom claim `role=super_admin` **plus** `email_verified`. A claim without a verified email → 403 on every admin API and 404 on admin pages | p11-security |
| Email verification | booking requests require a verified email (403 `email_unverified`) | code; booking-api-up |
| Password reset | the Firebase client SDK flow. The UI is enumeration-safe ("If an account with a password exists…"). Reset and session flows were tested | reset-e2e 26/26 |
| Google sign-in | popup flow, error codes mapped to friendly messages | auth-e2e (popup states); a real Google account was not used (emulator) |
| Open redirect | `safeNextPath` accepts only `/`-relative paths: no `//`, `/\`, `/api/`, `/login` or `/signup` | code; auth-e2e |
| Tokens / secrets in browser | no Admin credentials, private keys or service-account data in the client bundles (`.next/static` scanned). Auth errors log the code only, never the error object | grep of the build output; `errors.ts` |

## 5. Authorization audit

- **All 20 admin API routes** go through `adminMutation` → `requireSuperAdminApi`:
  - same-origin check;
  - verified session;
  - `super_admin` claim and a verified email.
- Each guard was tested directly on all 20 routes:

| Request | Result on all 20 routes |
|---|---|
| Signed out | **401** |
| Customer session | **403** |
| Admin claim, unverified email | **403** |
| Real admin + cross-site Origin | **403** |
| Real admin + no Origin | **403** |

- After all refused attempts, the real admin view confirms nothing changed:
  - the booking is still Confirmed;
  - the payment is not voided;
  - no attack note was added;
  - the vendor is still active.
- **All 14 admin pages:** signed out → sign-in redirect; customer → **404**, so the existence of the admin area is not revealed. The vendor page 404 carries no vendor name or phone number.
- **PDF routes** (`/api/documents/*`):
  - Super Admin: any document.
  - Customer: only documents of their own booking.
  - Anyone else: 404. Signed out: 401.

## 6. Customer isolation audit

Customer 1 vs Customer 2. Real sessions, real server, in-memory store.

| Attempt by Customer 1 | Result |
|---|---|
| Customer 2's booking page | the **same response as a non-existent booking**: identical visible page, "Booking not found", `noindex`; no name, phone or reference leaked |
| A walk-in (no-account) booking | the same not-found response |
| Customer 2's receipt PDF; Customer 2 → Customer 1's receipt / quotation PDF | 404 / 404 / 404 |
| A change / cancel request on Customer 2's booking | 404 |
| Reviewing Customer 2's booking | 404 |
| Marking Customer 2's notification read | 404 (same as missing); it stays unread |
| Own booking list | contains no Customer 2 or walk-in bookings |
| Own booking page | no internal payment note, vendor name, vendor phones, ops data or admin email |

- Notifications are filtered by `customerId == session uid` in the query **and** checked again.
- The Firestore rule also allows only the owner's notifications (`resource.data.customerId == request.auth.uid`).
- Note: the not-found response is HTTP **200** (not 404) because `loading.tsx` starts streaming before `notFound()`. The body is identical for "foreign" and "missing" and is marked `noindex`. Informational, no leak (§24).

## 7. Firestore rules audit

`firestore.rules` was reviewed collection by collection:

- **Default deny:** only the listed matches exist; no wildcard allow.
- `users/{uid}`:
  - owner get; Super Admin get; **no list**;
  - create and update with a fixed field set (`hasOnly`) and immutable uid / email / provider / createdAt;
  - `emailVerified` must equal the token; **no role field accepted**; delete denied.
- `bookings`, `slotLocks`, `bookingRequests`, `adminAudit`, `businessConfig`, `payments`, `quotations`, `counters`, `eventOperations`, `vendors`, `vendorAssignments`, `communications`, `reviews`: **`allow read, write: if false`**. All access goes through server code with the Admin SDK.
- `notifications`: get / list only where `resource.data.customerId == request.auth.uid`; create / update / delete denied, so ownership and type are immutable from the browser.
- Financial records are immutable from browsers. Server code never deletes payments (voiding keeps the record).
- **No rule was loosened in this phase.** The 82-test rules suite exists (`scripts/test-security-rules.mjs`), but its Firestore part could **not** run (§23).

## 8. Storage audit

- `storage.rules`: `match /{allPaths=**} { allow read, write: if false; }`.
- No feature uploads or reads Storage. Path traversal, MIME and size checks are therefore not applicable: nothing can be written.
- The public site's images and videos are static files under `/public`, which is intentionally public.
- **Executed on the real Storage emulator:** `firebase emulators:exec --only storage … "node scripts/test-security-rules.mjs --only=storage"` → **3/3 passed**:
  - signed-out upload denied;
  - signed-in upload denied;
  - signed-out read denied.
- The client no longer initialises or bundles the Storage SDK (it was unused).

## 9. Booking security audit

- **Duplicate / concurrent booking:** a transactional slot lock and an idempotent `requestKey`. Covered by the existing concurrency tests in `npm run test:booking` (**in-memory**, 199/199) and booking-api-up 21/21. The real-Firestore concurrency tests are NOT EXECUTED (§23).
- **Stale / expired locks, status transitions, capacity, same-day rules, customer limit** (`maxOpenRequestsPerCustomer` = 3 → 429): in-memory unit tests plus booking-api.
- **Server-owned fields:** the booking body allows only 12 listed fields. Injecting `status`, `customerId`, `pricing`, `total`, `amountPaid`, `paymentStatus`, `financialStatus`, `approvedBy`, `createdAt`, `updatedAt`, `adminNotes` or `source` gives **400 unexpected_field** each time (p11-security).
- **Invalid values all give 400:** negative / string / absurd guest counts, past or malformed dates, unknown hall / slot, object-injection event type, 500-item arrays, empty keys, over-long notes. Array body → 400, invalid JSON → 400, oversize → 413.
- **Modification / cancellation:** only through change requests, which check ownership; the admin decides inside a transaction. A foreign booking → 404.
- The booking engine was not changed.

## 10. Finance security audit

- **Customers cannot create payments:** all finance APIs are admin-only (§5). Firestore denies `payments`, `quotations` and `counters` to browsers.
- **Payment validation (admin)** returns **400** for each of these:
  - negative, zero, string, fractional or absurd amounts;
  - an unknown method;
  - a future `paidOn`;
  - injected `receiptNumber`, `total` or `remaining`.
- **Overpayment** above the remaining balance → **409** (nothing recorded). Totals, balance and receipt data are computed inside the transaction.
- **Idempotency:** the same `requestKey` replays the **same** payment (200, `replayed`). Reusing the key with different data → **409** (p11-security).
- **"Total below paid → Refund / financial adjustment required":** the protection exists (`total_below_paid`) and is tested in-memory (`finance.test.ts`, `notifications.test.ts`). No refund feature was invented.
- **Immutable history:**
  - payments are voided, never edited or deleted;
  - issued quotations are permanent; only drafts can be discarded;
  - receipt and quotation snapshots are rendered as stored;
  - PDFs come only from stored snapshots.
- These are covered by finance-e2e 56/56 and the finance unit tests.
- **Number counters** are transactional (unique quotation / receipt numbers). This is covered in-memory; real-Firestore concurrency is NOT EXECUTED.

## 11. Notifications / WhatsApp audit

**Notifications**
- Created only server-side, inside the transaction of the change they describe, with event-derived IDs: a retry does not duplicate (unit tests).
- A customer reads only their own. Mark-read accepts only `notificationId` or `all`:
  - extra fields → 400;
  - malformed id → 404;
  - a foreign id → 404.
- The unread count is a real `count()` query.
- Rate limit: 60/min per customer → then **429** (verified).

**WhatsApp (manual)**
- The server builds the message from authoritative records.
- Request fields are whitelisted:
  - a `url` field → 400, so no arbitrary URL can be injected;
  - another booking's payment → refused (`booking_mismatch`).
- The link is always `https://wa.me/<digits>?text=<encodeURIComponent>`, and the number is validated (`whatsAppLink` throws otherwise).
- Vendor messages use the vendor record only.
- The record status is **"initiated"**: never "sent" or "delivered" (verified).
- The rate limit is 20 initiations / 60 previews per minute per admin.
- No secrets are in any message. The public inquiry link uses the configured business number only.

## 12. Reviews audit

- Only the owner of a **completed** booking can review it (foreign → 404).
- One review per booking (`rv_<sha256(bookingId)>`). An edit returns the review to pending.
- `status` cannot be sent: self-approval is refused (400).
- Rating must be an integer 1–5. Text must be 10–1000 characters, the name 2–60.
- Moderation is Super Admin only, audited, and the audit holds no text.
- The public page shows **approved only**, and its aggregate comes from approved reviews only.
- The submit rate limit is 10/min → **429** (verified).
- No fake reviews exist. The JSON-LD has no `aggregateRating`.

## 13. Input / XSS audit

- **Stored XSS was tested with script / img-onerror / event-handler payloads:**
  - profile name;
  - booking contact name and notes (accepted as plain text);
  - an internal ops note.
- They were rendered on the customer profile, the customer booking list, the **admin booking sheet** and the **admin event sheet**. Every one was **escaped**: no live tag or handler.
- `dangerouslySetInnerHTML` is used only for:
  - JSON-LD, through `jsonLdHtml`, which escapes `<` and is built from config and static data;
  - one static constant script (`document.documentElement.classList.add('js')`).
- No `innerHTML`, `eval` or `new Function` anywhere in `src`.
- Notification `actionUrl` is rendered only if it matches `/account/...`.
- Validators reject unknown fields on every customer API and on the admin settings, vendor, payment and WhatsApp APIs. Admin routes read only named fields, so extra keys are ignored rather than stored.

## 14. Rate limiting

| Endpoint | Limit | Verified |
|---|---|---|
| Review submit | 10 / min / customer | yes, 429 on the 11th |
| Notification read | 60 / min / customer | yes, 429 on the 61st |
| WhatsApp initiate / preview | 20 / 60 per min / admin | code (comm-e2e covers the flow) |
| Booking requests | max 3 open requests per customer (business rule) | booking-api |
| Change requests | one open request per booking | portal-e2e |
| Login / signup / password reset | Firebase Auth's own quotas (`auth/too-many-requests` mapped to a message) | code |
| Session mint, profile PATCH, public availability | **no app-level limit** | see finding L7 |

- The limiter is in-process, per server instance; it is not distributed. This is documented in `rate-limit.ts`.
- **Public `/api/availability`:**
  - no limit, but the range is bounded (an oversized range → 400);
  - it returns free / held / booked only.
- A distributed or edge limit (for example App Check or the hosting WAF) is a Phase 12 hosting decision.

## 15. Secrets / environment audit

- **Git history** (1 commit) and the **working tree** were scanned for private keys, `private_key`, Google API keys, `sk_live`, GitHub tokens and `client_email`. **None found.**
- The **built client bundles** (`.next/static`) were scanned for `FIREBASE_ADMIN`, `PRIVATE_KEY` and `private_key`. **None found.**
- The repository root `.gitignore` covers:
  - `.env`, `.env.*` (except `.env.example`);
  - `*.pem`, `*.key` and service-account / credentials JSON files;
  - `.next/`, `node_modules/` and debug logs.
- `.env.local` and `.env` are confirmed ignored (`git check-ignore`).
- **`NEXT_PUBLIC_*` variables:** the Firebase web config only (public by design), the emulator switch, and the site URL.
- **Server-only:** `FIREBASE_ADMIN_*`, read only in `src/lib/firebase/admin.ts`, which imports `server-only`.
- **Logging:** only error **codes** are logged (`[auth]`, `[auth/session]`, `[booking]`). No tokens, cookies, passwords, payment details or customer data are logged.
- The E2E memory mode switches on only when all of the following hold, so a real deployment can never use it:
  - `SADIQ_PEARL_E2E_MEMORY_STORE=1`;
  - an Auth-emulator host is set;
  - the project is a `demo-*` project;
  - no real credentials are configured.
- **Change:** `NEXT_PUBLIC_SITE_URL` was missing from `.env.example`; it is now documented there.

## 16. Dependency audit

**`npm audit` before any change:** 6 findings (4 high, 2 moderate), all transitive.

| Package | Path | Advisory | Reachable? | Action |
|---|---|---|---|---|
| `@grpc/grpc-js` 1.9.16 (high) | `firebase` → `@firebase/firestore` | GHSA-m9gg-hp2v-232j (`getAuthContext` mTLS), GHSA-f596-whhp-79r4 (gRPC **server** error messages) | **No**: the app uses the Firestore web SDK only in the browser (WebChannel, no gRPC server, no mTLS) | none; documented |
| `@firebase/firestore`, `@firebase/firestore-compat`, `firebase` (high) | same chain | inherited from grpc-js | no | npm's only "fix" is `firebase@9.14.0`, a breaking **downgrade**, so it was not applied |
| `uuid` <11.1.1 (moderate) | `firebase-admin` → `@google-cloud/storage` → `gaxios` | GHSA-w5hq-g745-h8pq (`buf` bounds in v3/v5/v6) | no: requires passing `buf` to v3/v5/v6 | none; firebase-admin pins the range |
| `gaxios` (moderate) | same | inherited | no | none |

**Next.js:**
- `npm audit` did not flag Next.
- Next.js published the **September 2026 security release** on 2026-09-30, fixed in 16.3.8 (1 high, 5 medium, 1 low).

| Advisory | Why this app was not affected |
|---|---|
| SSRF in image optimization (high) | requires `images.remotePatterns`; none are configured |
| Cache poisoning (two advisories) | needs the Pages Router SSG/ISR or a root catch-all; the app uses neither |
| Metadata-image `dynamicParams` | webpack builds only; the app builds with Turbopack |
| Two `use cache` / Draft Mode issues | the app uses neither |
| MCP endpoint | `next dev` only |

- So the app was **not in an affected configuration**.
- It was patched anyway, as the smallest compatible change: `next` and `eslint-config-next` 16.3.7 → **16.3.8**. Only the `next` / `@next/*` packages changed in the lockfile.
- The full regression suite then ran green.
- Other outdated packages are major versions (eslint 10, tailwind 4, TypeScript 7, @types/node 26). They were not upgraded: no security reason, and the task says no migrations.

Sources:
- https://nextjs.org/blog/september-2026-security-release
- https://github.com/advisories/GHSA-m9gg-hp2v-232j
- https://github.com/advisories/GHSA-f596-whhp-79r4
- https://github.com/advisories/GHSA-w5hq-g745-h8pq

## 17. Security headers

| Header | Before | After (verified on the running production server) |
|---|---|---|
| X-Content-Type-Options | nosniff | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin | same |
| X-Frame-Options | SAMEORIGIN | same |
| Permissions-Policy | camera / microphone / geolocation off | same |
| Content-Security-Policy | **none** | `frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'` |
| Strict-Transport-Security | **none** | `max-age=31536000` (production builds only; no includeSubDomains / preload until the domain is confirmed) |
| X-Powered-By | `Next.js` | **removed** (`poweredByHeader: false`) |

- **The CSP is deliberately narrow.** Scripts, styles, media and connections are *not* restricted, so Firebase Auth (popup and iframe), the emulators, the hero videos and the inline JSON-LD keep working. All forms post to their own origin (checked).
- The whole browser regression suite passed with the new headers.
- **HSTS has no effect on the local http:// tests.** Browsers honour it only over HTTPS, so it takes effect only once the site is served over HTTPS.
- A nonce-based script CSP is a separate, tested change (Phase 12 or later).
- **CORS:** no route sets `Access-Control-Allow-*`. A preflight and a GET from a foreign origin got no `Access-Control-Allow-Origin` (verified).
- **API caching:** authenticated APIs and PDFs are `no-store` (PDFs `private, no-store`).

## 18. Performance audit

Measured on the test build (`p11-perf.mjs`, production server, local machine).

| Page | Status | HTML (gzip) | JS files | JS raw (gzip) | CSS (gzip) | Images | Videos |
|---|---|---|---|---|---|---|---|
| `/` | 200 | 32 KB | 10 | 657 KB (202 KB) | 12 KB | 33: 32 lazy, 1 eager (LCP poster) | 5, all `preload="none"` in HTML |
| `/gallery` | 200 | 17 KB | 10 | 637 KB (198 KB) | 12 KB | 34, all lazy | 4, `preload="none"` |
| `/reviews` | 200 | 9 KB | 9 | 619 KB (192 KB) | 12 KB | 2 lazy | — |
| `/book` | 200 | 11 KB | 10 | 653 KB (203 KB) | 12 KB | 2 lazy | — |
| `/login` | 200 | 5 KB | 10 | 1241 KB (376 KB) | 12 KB | 1 lazy | — |

**What the JavaScript is**
- About 150 KB gzip of the public-page JS is the React / Next runtime. The application code is about 40–50 KB.
- **Firebase is not loaded on public pages.** The Firebase chunk (~189 KB gzip) loads only on auth and account pages.

**Hero and media**
- The hero shows the poster first (eager, `fetchPriority=high`) and starts the video **only after window load + 250 ms**.
- It skips video entirely under Save-Data or prefers-reduced-motion.
- It pauses off-screen.
- The other films use `preload="none"` and IntersectionObserver.

**Pages and fonts**
- Fonts are self-hosted through `next/font`, so no render-blocking third-party CSS.
- `/` and `/gallery` are static (○). `/reviews` and `/book` are dynamic because they read live data.

**Change made**
- Removing the unused Storage SDK reduced `/login` JS from 1251 KB to 1241 KB raw (379 → 376 KB gzip).
- This is small but certain. No other change met the "measurable / high-confidence" bar.

## 19. Accessibility audit

New harness `p11-a11y.mjs` (32 checks): **23 pages** (7 public, 5 customer, 11 admin) at 6 widths.

| Check | Result |
|---|---|
| Horizontal overflow, exactly one `h1`, `alt` on every image | all pages × all widths: **pass** |
| Every visible button / link has an accessible name; every visible form field has a label | **pass** |
| Heading levels never skip | **pass** |
| Touch targets, WCAG 2.2 AA 2.5.8 (≥ 24 px, or inline / sufficiently spaced) | **pass** |
| Keyboard: first Tab gets a visible focus indicator | **pass** |
| Booking dialog: `aria-modal`, focus inside, Tab trapped, Escape closes, focus returns to the opener | **pass** |
| The closed site-menu dialog is hidden | **pass** |
| Login errors: `aria-invalid`, linked to the message, **announced** | **pass after the fix** (below) |
| prefers-reduced-motion: no video plays | **pass** |
| Status shown as text, not colour alone | **pass** |
| No unexpected console errors | **pass** |

**Fix made:**
- On the auth forms (shared `TextField`), the booking-request flow and the change-request forms, field errors appeared but were not announced: focus stayed on the button and there was no live region.
- They now use `role="alert"`, the same pattern the WhatsApp inquiry form already used.

**Below 44 px (AAA) but passing AA 2.5.8 by its exceptions** (informational):
- the Google-Maps link, 22 px high, isolated;
- the footer "Booking terms & conditions" link, 16 px, isolated;
- the inline "Booking terms" button inside a sentence.

The dialog and lightbox focus behaviour is also covered by p10-e2e. Harness corrections made during development (selectors only, recorded honestly):
- the dialog selector had matched the closed site menu;
- the target-size check now implements the WCAG spacing and inline exceptions instead of a flat 24 px rule.

## 20. Mobile audit

- p11-a11y covers 320 / 375 / 390 / 430 / 768 / 1280 px on all 23 pages:
  - customer: account, bookings, booking detail, notifications, profile;
  - admin: dashboard, bookings, booking sheet, calendar, events, event sheet, vendors, vendor, communications, reviews, settings;
  - public: home, gallery, reviews, book, login, signup, forgot password.
- No overflow, and layouts render. Screenshots are in `spt/shots-p11/` (320 and 1280).
- **Critical flows** are exercised end-to-end by the existing harnesses, all passing:

| Flow | Harness | Result |
|---|---|---|
| signup / login / Google states | auth-e2e | 25/25 |
| password reset and sessions | reset-e2e | 26/26 |
| booking request | booking-ui | 31/31 |
| account, booking detail, change requests, profile | portal-e2e | 89/89 |
| notifications | comm-e2e | 49/49 |
| admin login, dashboard, booking, calendar | admin-panel-e2e | 68/68 |
| event sheet, vendors | ops-e2e | 59/59 |
| communication center | comm-e2e | 49/49 |
| review moderation | p10-e2e | 54/54 |
| settings | settings-e2e | 44/44 |

- No UI was changed for cosmetic reasons.

## 21. Failure-mode audit

| Failure | Behaviour | Evidence |
|---|---|---|
| Firestore unreachable (real adapter, nothing listening) | honest 503 / failure states, no fake success | booking-api-down 23/23, portal-failure 8/8, admin-failure 6/6, inquiry-failure 3/3 |
| Firebase Admin not configured | 503 `booking_unavailable` / `auth_unavailable`; the auth UI shows "not configured" | code; earlier phases |
| Auth unavailable / invalid session | redirect to sign-in / 401 | p11-security |
| Invalid / stale / duplicate requests | 400 / 409 `stale` / idempotent replay | p11-security, unit tests |
| Unauthorized / malformed | 401 / 403 / 404 / 400 / 413 | p11-security |
| Notification write failure | the whole transaction fails, so no half-saved state | unit (`failNotificationWrites`) |
| Payment failure / overpayment | 409, nothing recorded | p11-security, finance-e2e |
| PDF generation failure | 503 `documents_unavailable` (logged by code) | code review |
| Database timeout | 503 after 10–15 s, "Nothing is shown as saved" | code (`withTimeout`) |
| Missing configuration | booking fails closed (503) | code |
| Error bodies | no stack traces, file paths, env names or credentials | p11-security |
| Unknown page | 404, `noindex`, no stack | p11-security |

## 22. Exact test results

All tests were run in this phase on the final code. The browser suites used the Phase 11 test build (Next 16.3.8, new headers).

| Command / harness | Category | Result |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | static | **0 errors** |
| `npx eslint src tests` | static | **0 errors, 0 warnings** |
| `npm run lint` (whole repo) | static | **0 errors**, 1 warning (`postcss.config.mjs` anonymous default export; pre-existing, untouched) |
| `npm run test:booking` | **in-memory** | **199/199** (before the test fix: 198/199, the flake in §3) |
| Storage rules, `--only=storage` | **Storage emulator** | **3/3** |
| `npm run test:rules` | real Firestore | **NOT EXECUTED — ENVIRONMENT BLOCKER** (§23) |
| `npm run test:booking:firestore` | real Firestore | **NOT EXECUTED — ENVIRONMENT BLOCKER** (§23) |
| Emulator-wired test build (`next build`) | build | **Success** |

**Full E2E regression:** one run (`run-regress.mjs`) with a real server, the memory store and the Auth emulator. **Every harness passed on the first run; nothing was rerun.**

| Harness | Result |
|---|---|
| portal-e2e | **89/89** |
| admin-panel-e2e | **68/68** |
| settings-e2e | **44/44** |
| finance-e2e | **56/56** |
| ops-e2e | **59/59** |
| comm-e2e | **49/49** |
| p10-e2e | **54/54** |
| **p11-security (new)** | **77/77** |
| **p11-a11y (new)** | **32/32** |
| p11-perf (measurement) | ran (exit 0), §18 |
| booking-api (server up) | **21/21** |
| booking-ui | **31/31** |
| admin-e2e | **9/9** |
| auth-e2e | **25/25** |
| reset-e2e | **26/26** |
| logout-check | **ok** (copied cookie rejected at 0 ms and 1100 ms gaps) |
| booking-api (Firestore down) | **23/23** |
| portal-failure | **8/8** |
| admin-failure | **6/6** |
| inquiry-failure | **3/3** |

**`npm run build`** (production environment, no emulator variables, `NEXT_PUBLIC_SITE_URL` unset):
- **exit code 0, success**;
- compiled in 8.4 s, TypeScript passed, **35/35** static pages;
- **0** lines matching error, credential or TimeoutError;
- **1 warning, by design:** the new `[config] WARNING: NEXT_PUBLIC_SITE_URL is not set…` (printed twice, because Next loads the config twice).

**Environment limitations:**
- CPU load from other processes on the machine.
- The Firebase CLI is not on PATH: `npm run test:rules` as written fails with `'firebase' is not recognized`. The emulator runs here used the `firebase-tools` already installed in another local project, through a temporary PATH shim (nothing installed).
- The default `java` on PATH is JDK 17, which firebase-tools rejects ("no longer supports Java version before 21"). JDK 25 was selected with `JAVA_HOME`.

**Harness bugs fixed during development (test-only, before the final run):**
- `p11-security`: a trailing slash in one URL caused a 308; the sitemap check matched the `?` of `<?xml`.
- `p11-a11y`: see §19.

## 23. Firestore verification status

**Firestore emulator verification: NOT EXECUTED — ENVIRONMENT BLOCKER.**

- **Attempted:**
  - `npm run test:rules` (auth + firestore + storage);
  - `npm run test:booking:firestore` (all `tests/firestore/*.test.ts`, including the Phase 8–10 Firestore tests).
- Both were run with JDK 25. The Auth emulator that had been holding port 9099 was this session's own process; it was stopped first, so the port was free.
- **Exact error** (firestore-debug.log):

```
io.netty.channel.ChannelException: failed to open a new selector
Caused by: java.io.IOException: Unable to establish loopback connection
Caused by: java.net.SocketException: Invalid argument: connect
java.lang.IllegalStateException: failed to create a child event loop
```

- Firebase reported: "Firestore Emulator has exited with code: 1".
- Java's NIO selector cannot open its internal loopback connection on this machine. This is an OS / network-stack problem, not a project problem. The same blocker has been present since Phase 2. Earlier-ruled-out workarounds were not tried.
- **What did run:**
  - the **Storage emulator** (3/3);
  - the **Auth emulator** (all E2E);
  - the **in-memory** store (all logic).
- **What did not run:** real Firestore rules (82 tests) and the real-adapter transaction / concurrency tests. They must run on a machine or CI where the Firestore emulator starts, before launch.

**Indexes** (`firestore.indexes.json`): 3 composite indexes, checked against every query in `firestore-store.ts`.

| Query | Index |
|---|---|
| `slotLocks` hallId == + date range | composite (hallId, date) ✔ |
| `bookings` customerId == + status in | composite (customerId, status) ✔ |
| `notifications` customerId == + orderBy createdAt desc (+ before cursor) | composite (customerId, createdAt desc) ✔ |
| `bookings` eventDate range + orderBy eventDate; notifications / communications createdAt range + orderBy | single-field (automatic) |
| equality-only combinations (requests: customerId / bookingId / status; notifications: customerId + readAt == null, incl. `count()`; audit: entityType + entityId; assignments; payments; quotations; reviews by status; vendors by active) | single-field index merging (automatic) |

- No missing index was identified by inspection, and none was added.
- Real-Firestore confirmation is pending with the emulator blocker. The emulator does not enforce indexes in any case, so the production console is the final check.

## 24. Security findings register

### Critical
None identified during this audit.

### High
None identified during this audit.

### Medium

**M1 — The production domain falls back to a placeholder without warning.**
- **Issue:** without `NEXT_PUBLIC_SITE_URL`, the canonical URLs, sitemap, robots `Host` / `Sitemap`, Open Graph URLs and JSON-LD silently use the placeholder `https://www.sadiqpearlmarquee.com`. That host is unconfirmed and did not resolve in the Phase 0 audit. The variable was also missing from `.env.example`.
- **Evidence:** `src/lib/config.ts`; `robots.txt` output; `.env.example`.
- **Area:** SEO / production configuration.
- **Action:** every production build now prints a clear warning (`next.config.mjs`), and the variable is documented in `.env.example`. No domain was invented.
- **Remaining risk:** if the site is deployed without the variable, search engines get canonical URLs on an unconfirmed host. **The domain must be set before launch.**

### Low

**L1 — Next.js 16.3.7 was behind the September 2026 security release.**
- Not in an affected configuration (§16).
- Action: upgraded to 16.3.8 and ran the full regression. Remaining: none known.

**L2 — No Content-Security-Policy.**
- X-Frame-Options already blocked framing.
- Action: added a narrow CSP (§17).
- Remaining: scripts are not restricted; a nonce-based CSP is deferred.

**L3 — No HSTS.**
- Action: HSTS on production builds.
- Remaining: effective only over HTTPS; includeSubDomains / preload waits for the domain decision.

**L4 — The `X-Powered-By: Next.js` banner was sent.**
- Action: removed. Remaining: none.

**L5 — Field validation errors were not announced to screen readers** (auth, booking-request and change-request forms).
- Action: `role="alert"`. Remaining: none known.

**L6 — Flaky unit test** (`reviews.test.ts`, a test defect; §3).
- Action: fixed (stricter). Remaining: none.

**L7 — No app-level rate limit on session minting, profile PATCH, or the public `/api/availability`; and the limiter is per instance.**
- Mitigations already in place:
  - session minting requires a valid fresh ID token (Firebase quotas apply);
  - profile PATCH needs a session;
  - availability is range-bounded and returns no personal data.
- **Residual risk:** availability could be called repeatedly to cause Firestore read cost.
- **Action:** documented. A hosting-level or App Check limit belongs to Phase 12. Adding an IP limiter now would depend on unknown proxy headers.

**L8 — `npm audit` reports 4 high / 2 moderate transitive advisories** (grpc-js under the web Firestore SDK; uuid under firebase-admin storage).
- Not reachable in this app (§16). The only offered fix is a breaking downgrade.
- Action: documented. Remaining: wait for Firebase SDK updates.

**L9 — The unused Firebase Storage SDK was initialised and bundled.**
- Action: removed (~3 KB gzip). Remaining: none.

### Informational

- **I1:** a foreign or missing customer booking returns HTTP 200 with the not-found page and `noindex`, because `loading.tsx` streams first. The response is identical for both cases and there is no leak.
- **I2:** the CSRF origin check compares `Origin` with `X-Forwarded-Host` / `Host`. That is correct behind a trusted proxy, and browsers cannot set these cross-site. Confirm the hosting proxy overwrites `X-Forwarded-Host` (Phase 12).
- **I3:** the public review payload contains `reviewId` = `rv_` + sha256(bookingId). It is non-reversible; booking IDs are random 96-bit values.
- **I4:** some targets are below 44 px (AAA) but pass AA 2.5.8 by its exceptions (§19).
- **I5:** the admin dashboard and customers pages read up to 2,000 / 5,000 bookings per view. That is bounded and fine at single-venue scale; revisit if history grows large.
- **I6:** `/reviews` is dynamic and reads at most `PUBLIC_LIMIT` approved reviews per request. Caching is deferred; a build-time prerender would need credentials during the build.
- **I7:** `npm run test:rules` depends on a global `firebase` CLI and Java 21+. Neither is on this machine's default PATH; documented for CI setup.
- **I8:** there is one pre-existing lint warning in `postcss.config.mjs`.

## 25. Performance findings

- **P1 (fixed, small):** the unused Storage SDK on auth pages: −10 KB raw / −3 KB gzip.
- **P2 (no action):** public pages ship about 200 KB gzip of JS, mostly the React / Next runtime. No high-confidence reduction was found without restructuring; the task says no rewrites.
- **P3 (no action, by design):** Firebase (~189 KB gzip) loads on auth and account pages only.
- **P4 (OK):**
  - the hero video is deferred until after load and respects Save-Data and reduced motion;
  - every non-hero image is lazy;
  - responsive `sizes` are set on all srcsets;
  - every film is `preload="none"`.
- **P5 (OK):**
  - all Firestore list queries have limits;
  - batched `getAll` is used instead of N+1 reads;
  - notifications are paginated (20 + cursor) with a `count()` unread badge;
  - mark-all is capped at 200 per call.
- **P6 (Informational):** I5 and I6 above.

## 26. Changes made

1. **Next.js security patch:** `next` and `eslint-config-next` ^16.3.7 → ^16.3.8 (lockfile: `next` and `@next/*` only).
2. **Headers** (`next.config.mjs`): a narrow CSP, HSTS on production builds, and `poweredByHeader: false`.
3. **Production-domain safeguard:** a build-time warning when `NEXT_PUBLIC_SITE_URL` is unset or invalid (`next.config.mjs`), and the variable is documented in `.env.example`.
4. **Accessibility:** `role="alert"` on field errors in `auth/fields.tsx`, `booking/BookingRequestFlow.tsx` and `account/ChangeRequests.tsx`.
5. **Bundle:** the Firebase Storage SDK is no longer initialised or bundled (`src/lib/firebase/client.ts`).
6. **Test fix:** `tests/booking/reviews.test.ts` uses non-hex uids, so its leak check is deterministic and stricter.
7. **README:** a "Security hardening (Phase 11)" section.

No rules were changed, no feature was added, and the booking, finance, notification and review logic is unchanged.

## 27. Changed files

**New**
- `SADIQ_PEARL_PHASE_11_REPORT.md`

**Modified**
- `package.json`, `package-lock.json`
- `next.config.mjs`
- `.env.example`
- `README.md`
- `src/lib/firebase/client.ts`
- `src/components/auth/fields.tsx`
- `src/components/booking/BookingRequestFlow.tsx`
- `src/components/account/ChangeRequests.tsx`
- `tests/booking/reviews.test.ts`

**Deleted**
- none

**Test harness (outside the repository, `%TEMP%\claude\spt\`, test-only)**
- New:
  - `p11-security.mjs`, `p11-a11y.mjs`, `p11-perf.mjs`;
  - `run-p11.mjs`;
  - `p11-probe.mjs`, `p11-dbg.mjs` (diagnostics);
  - `fbshim/firebase.cmd` (PATH shim to the existing local firebase-tools).
- Modified: `run-regress.mjs` (Phase 11 steps added).

No commits were made.

## 28. Dependencies added

**None.**
- Only version bumps within the existing major: `next` 16.3.7 → 16.3.8 (security release), `eslint-config-next` 16.3.7 → 16.3.8 (matching).
- No package was downloaded besides these.

## 29. Remaining production configuration

None of these were invented or filled in.

**Domain and Firebase setup**
- **Production domain** → `NEXT_PUBLIC_SITE_URL`. Then decide on HSTS includeSubDomains / preload.
- **Firebase project:** web config (`NEXT_PUBLIC_FIREBASE_*`), Admin credentials (`FIREBASE_ADMIN_*` or hosting ADC), and the authorized domains for Google sign-in and email action links.
- **Super Admin account:** the claim is set with `scripts/set-super-admin.mjs`, and the email must be verified.
- **Deploy** `firestore.rules`, `storage.rules` and `firestore.indexes.json` to the real project.

**Business information**
- Real prices, the advance-payment rule, the refund / cancellation policy, and the printed-card surcharge / service-charge decision.
- Slot timings.
- Real vendor records (entered by the admin).
- A **licensed Urdu font** for PDFs. Still accurate: no Urdu font is in the project and `@pdf-lib/fontkit` is not installed, so Urdu prints as "?" through `pdfSafe()`. No font was downloaded.

**Providers**
- A WhatsApp Business API or other provider, if automated messages are ever wanted. Today messaging is manual and recorded as "initiated".

## 30. Known limitations

- **Real Firestore not verified:** the rules (82 tests) and the real-adapter transactions / concurrency could not run (§23). Everything else ran in-memory or on the Auth / Storage emulators.
- **Rate limits are per server instance;** some endpoints rely on Firebase quotas or business limits (L7).
- **The CSP does not restrict scripts.**
- **HSTS only works over HTTPS.**
- **Session expiry was not reproduced live** (5-day lifetime); it relies on Firebase's verification.
- **Google sign-in** was tested only for its UI states; no real Google account was used.
- **The not-found response for bookings is HTTP 200 + noindex** (I1).
- **Performance was measured on a loaded local machine.** Lighthouse and field data on real hosting belong to Phase 12.
- **The Urdu PDF font is missing** (§29).

## 31. Explicit items deferred to Phase 12

- **Deployment:** domain and DNS, HTTPS, the hosting configuration (including `X-Forwarded-Host` handling) and production credentials.
- **Real verification:** run `npm run test:rules` and `npm run test:booking:firestore` where the Firestore emulator starts (CI), then verify against the deployed project (rules, indexes).
- **Abuse controls:** edge / hosting rate limiting or Firebase App Check for public endpoints (L7).
- **CSP:** an optional nonce-based script CSP, tested against Firebase Auth and video.
- **Measurement:** real-device Lighthouse / Web Vitals on the hosted site, and load testing.
- **Operations:** monitoring, alerting, backups and the launch checklist.

Phase 12 was **not** started. Nothing was deployed, no DNS was changed, no production credentials were configured, and the site is **not** live.
