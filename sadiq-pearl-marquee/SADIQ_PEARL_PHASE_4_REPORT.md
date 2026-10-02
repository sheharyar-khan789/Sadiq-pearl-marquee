# Sadiq Pearl Marquee — Phase 4 Report (Customer Portal & Booking Management)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Customer portal: dashboard, My bookings (+ filters), booking details (pricing, receipts, timeline), modification & cancellation **requests**, profile editing (incl. Firebase-verified email change), WhatsApp support, loading / empty / error states |
| Not built (future phases) | Admin dashboard, approval of requests, admin calendar, payments/receipt generation, quotations, vendors, menus/packages/decor management, notifications, WhatsApp automation, reports, CMS |
| Data | **No production data was written.** No real Firebase project is connected. Tests used the Auth emulator, the in-memory test store and emulator-only accounts. |

> **Firestore emulator — still an environment blocker.** It still cannot start on this machine (the Java loopback socket fails; see the Phase 3 report). Therefore:
> - `npm run test:rules` is **NOT EXECUTED — ENVIRONMENT BLOCKER**. It now includes 6 new Phase 4 rules tests.
> - `npm run test:booking:firestore` is **NOT EXECUTED — ENVIRONMENT BLOCKER**.
>
> No real Firestore transaction or rules test is claimed as passed.

---

## 1. Implemented

- **Dashboard (`/account`):**
  - welcome by name;
  - **Your next event** (the soonest upcoming booking);
  - **Booking summary** with real counts (upcoming, pending, confirmed, completed, cancelled), shown only when the customer has bookings;
  - **Quick actions:** Book your event, View my bookings, Edit profile, WhatsApp support;
  - the existing account status panel (email verification, resend, sign-out).

  The bookings part streams in its own Suspense boundary, so account status and sign-out are usable at once even if the database is slow.
- **My bookings (`/account/bookings`):** booking cards show the event type, date, slot, hall, guests, a status badge (icon + text), the total and remaining balance **only when priced**, the reference, the created date and a "Cancellation/Change requested" flag.
  - Filters: All / Upcoming / Past / Pending / Confirmed / Cancelled. They are applied on the server to the customer's own list, as `?filter=` links that work without JavaScript.
- **Booking details (`/account/bookings/[bookingId]`):**
  - **Event**: date, slot, hall, event type, guests, reference;
  - **Selected services** and **Menu preference**, only when stored;
  - the customer's notes and the contact on the booking;
  - **Pricing**: line items, subtotal, service charge, total, advance required and received, remaining balance, or a **"Pricing pending"** state when there is no price;
  - **Receipts**: an honest empty state;
  - **Status** timeline built only from stored timestamps;
  - **Changes & cancellation**: request history plus request forms;
  - WhatsApp help with the reference pre-filled, and "Book another event".
- **Modification request:**
  - The customer can ask for a new date, slot, guest count, services (none are configured yet, so the section is hidden), menu preference, decoration preference or notes.
  - The request is stored for the venue team. **The booking and its slot lock are never changed.**
  - A new date/slot is checked and shown ("free at the moment / already requested / already booked, our team will review"). It is recorded but **never reserved**.
- **Cancellation request:** needs an "I understand this is a request" confirmation and takes an optional reason. **No cancellation or refund policy was invented**; the page says terms will be explained by the team.
- **Profile (`/account/profile`):**
  - **name** and optional **phone** are saved by a server API; the name is also copied to the Firebase Auth display name;
  - the sign-in email and its verification status are shown;
  - **change sign-in email** (email/password accounts) goes through Firebase `verifyBeforeUpdateEmail` after re-entering the password. The email changes **only after the link sent to the new address is opened**; then every session ends and the customer signs in again;
  - Google accounts are told the email is managed by Google;
  - there is a "Change password" link to the existing reset flow.
- **Email action links:** `/auth/action` now also handles `verifyAndChangeEmail` (confirm the new email) and `recoverEmail` (undo, with a prompt to reset the password).
- **Portal navigation:** Overview / My bookings / Profile tabs under the account header, marked with `aria-current`.
- **States:**
  - `loading.tsx` skeletons for every portal route; the pulse is turned off when `prefers-reduced-motion` is set;
  - empty states (no bookings, no upcoming event, empty filter, no receipts, no change requests);
  - error states (database unavailable or failing, booking not found, session expired, network failure, request or profile save failure), each with a retry action and WhatsApp.

## 2. Customer routes

| Route | Purpose |
|---|---|
| `/account` | Dashboard (extended from the Phase 2 account page, not duplicated) |
| `/account/bookings` | All of the customer's bookings, `?filter=` = all, upcoming, past, pending, confirmed or cancelled |
| `/account/bookings/[bookingId]` | One booking; "Booking not found" if it is missing **or belongs to someone else** |
| `/account/profile` | Profile, sign-in email, sign-in method |
| `POST /api/account/bookings/[bookingId]/requests` | Create a modification or cancellation request |
| `PATCH /api/account/profile` | Update name / phone |

All of them are protected by:
- the proxy, which checks that a cookie is present;
- the **`(account)` layout**, which verifies the session cookie (signature, expiry, **revocation**) before anything streams;
- **each page and API route again**, for its own data.

## 3. Customer data access

- All portal data is read **on the server with the Admin SDK**, using the uid from the verified session (`requireUser()` / `getSessionUser()`). No uid ever comes from the URL, body, localStorage or client state.
- **Bookings:** one query, `bookings where customerId == <session uid>` (limit 200), sorted and filtered on the server.
  - It is a single-field equality query, served by Firestore's automatic index.
  - The whole collection is never loaded, and nothing is filtered in the browser.
- **Requests:** `bookingRequests where customerId == uid [and bookingId == X] [and status == "open"]`. These are equality filters only, served by automatic single-field indexes, so **no new composite index** is needed.
- **Per-request deduplication:** React `cache()` for the dashboard/list loader, and a 10 s timeout on every read.
- **What reaches the browser:** only a **customer view** (`toCustomerView`). It never includes `adminNotes`, `createdBy`, `customerId`, `slotKey` or the raw hold time; a test checks this.

## 4. Booking access (ownership)

- `getOwnBooking(store, uid, bookingId)` returns a booking only if `booking.customerId === uid`. It also rejects malformed IDs (`bk_` + 24 hex).
- A booking that doesn't exist and **another customer's booking** get the **same** "Booking not found" answer, so booking IDs cannot be discovered.
- **Streaming note:** the portal streams (loading skeletons), so Next.js sends this not-found page as HTTP 200 with `noindex`, not HTTP 404.
  - No data of the other customer is ever loaded or sent; this was tested.
  - Real redirects for missing or invalid sessions do happen before streaming (in the layout).

## 5. Modification request architecture

`bookingRequests/{requestId}`, written only by the server:

| Field | Notes |
|---|---|
| `requestId` | `rq_` + 24 hex = sha256(session uid + request key). Resending the same submission (double click, retry) returns the stored request; nobody can collide with another customer's IDs. |
| `bookingId`, `customerId` | The customer comes from the session. Ownership is checked **inside the transaction**. |
| `type` | `modification` or `cancellation` |
| `status` | `open` (the only status a customer creates). `accepted`, `declined` and `withdrawn` are reserved for future admin tools. |
| `changes` | Only the values that actually differ from the booking: `eventDate`, `slotId`, `guestCount`, `serviceIds`, `menuPreferenceId`, `decorationPreference`, `notes` |
| `requestedSlot` | `{ slotKey, stateAtRequest }` when the date or slot changes: `available`, `held` or `booked` at request time (informational) |
| `reason` | Cancellation only (optional) |
| `bookingSnapshot` | The booking's date, slot, guests, menu and status when the request was made |
| `createdAt`, `updatedAt`, `decidedAt` | `decidedAt` is null until a future admin decision |

**Transaction:**
1. **Reads:**
   - the existing request (for idempotency);
   - the booking (owner and eligibility);
   - the booking's open requests;
   - the lock of the requested slot (read-only).
2. **Write:** the request only. It never writes the booking, its status or a slot lock.

**Rules:**
- Requests are possible only for **pending, under review or confirmed** bookings whose date has not passed.
- One open request of each type per booking.
- An open cancellation blocks new change requests.
- Asking for exactly what the booking already has returns `no_changes`.

**Validation:**
- Allowed fields only; `status`, `customerId`, `pricing`, `advanceReceived`, `adminNotes`, `hallId` and so on are rejected.
- Dates must be real, not in the past, and within the booking window.
- Known slot and menu, guests from 1 to 1,000, known services, text length limits.

## 6. Cancellation request architecture

It uses the same collection and transaction (`type: "cancellation"`). The booking stays in its current status. Cancelling it, and any refund or terms, is decided by the venue team in a future admin phase using the existing Phase 3 `changeBookingStatus` (which releases the slot lock).

**Schema change:** no field was added to `bookings`. Requests live in their own collection, so the Phase 3 booking schema is unchanged.

## 7. Security

- **Server-side authorisation:**
  - session cookie verification, with a revocation check, in the layout, every page and both APIs;
  - ownership checked in the transaction;
  - uid taken only from the session.
- **CSRF:** a same-origin check on both new APIs (the Phase 3 helper).
- **Customers cannot:**
  - read or change another customer's booking or request;
  - change a booking's status, payments, pricing, admin notes, ownership or slot locks (the API has no such fields and rejects them; rules deny direct writes);
  - set their own role, uid, email, verification or timestamps through the profile API (rejected);
  - write `phone` or `role` directly to `users/{uid}` (rules allow only name, photoURL, emailVerified and updatedAt).
- **Firestore rules:**
  - added `bookingRequests/*`: `allow read, write: if false` for browsers;
  - `bookings`, `slotLocks` and `users` are unchanged apart from a comment;
  - nothing is opened globally; there is no `if true`.
- **Email:**
  - Firebase Auth remains the owner of the email; Firestore's `users.email` is updated **only** after Auth has changed it (synced on the next profile visit);
  - booking contact snapshots keep the email that was used at booking time.
- **No sensitive extras:**
  - **address and CNIC are not collected**, because nothing needs them;
  - phone is optional.
- **Logs** hold error codes only.
- **Honest failures:** 503 with a code when the database is unavailable, never a fake success.
- **Double submission:** request and profile buttons are locked while sending, and the request key makes a retry idempotent.

**Local E2E test mode (new, test infrastructure only):**
- Because Firestore cannot run here, `src/lib/booking/server.ts` can switch to the in-memory test store. It does so only when **all** of these hold:
  - `SADIQ_PEARL_E2E_MEMORY_STORE=1`;
  - the Auth **emulator** is configured;
  - the project ID starts with `demo-`;
  - **no** Admin credentials or Cloud Run environment are present.
- A real deployment meets none of these, so it always uses Firestore.
- The mode logs a warning when active. Test data comes from a JSON seed generated with the real engine functions.
- It is not a replacement for Firestore, and it was not used to claim any Firestore result.

## 8. Files changed

**New**
- `src/lib/booking/request-model.ts`: change-request types and statuses
- `src/lib/booking/customer.ts`: ownership-checked reads, request validation, `submitChangeRequest`
- `src/lib/booking/portal.ts`: customer view, timeline, filters, counts, eligibility
- `src/lib/booking/portal-server.ts`: server loaders (cache + timeouts + safe logging)
- `src/lib/booking/format.ts`: date, time and PKR formatting (venue time zone)
- `src/lib/booking/testing/memory-store.ts`: moved from `tests/booking/` and extended (requests, portal reads, seeding)
- `src/lib/account/profile.ts`: profile validation, `ProfileStore`, test store
- `src/lib/account/firestore-profile-store.ts`: Admin SDK profile store
- `src/app/(account)/account/bookings/page.tsx`, `.../[bookingId]/page.tsx`, `.../[bookingId]/not-found.tsx`, `src/app/(account)/account/profile/page.tsx`
- `loading.tsx` for `account`, `account/bookings`, `account/bookings/[bookingId]`, `account/profile`
- `src/app/api/account/bookings/[bookingId]/requests/route.ts`, `src/app/api/account/profile/route.ts`
- `src/components/account/`: `PortalNav`, `StatusBadge`, `BookingCard`, `BookingSections` (Section, PricingSummary, BookingTimeline), `ChangeRequests`, `ProfileForm`, `EmailChangeForm`, `PortalStates` (WhatsApp link, empty, error, back link, skeletons)
- `tests/booking/portal.test.ts`
- `SADIQ_PEARL_PHASE_4_REPORT.md`

**Modified**
- `src/app/(account)/account/page.tsx`: the dashboard
- `src/app/(account)/layout.tsx`: session check before streaming, portal nav, wider content
- `src/proxy.ts`: passes the requested path to the layout (for the post-sign-in return)
- `src/components/auth/AccountPanel.tsx`: removed its WhatsApp/booking row (now under Quick actions)
- `src/components/auth/EmailActionHandler.tsx`, `src/app/(auth)/auth/action/page.tsx`: email-change link modes
- `src/lib/booking/store.ts`, `src/lib/booking/firestore-store.ts`: portal reads and request writes
- `src/lib/booking/server.ts`: profile store, gated local E2E mode
- `firestore.rules`: `bookingRequests` closed to browsers
- `scripts/test-security-rules.mjs`: 6 new rules tests
- `tests/booking/engine.test.ts`: memory-store import path
- `README.md`: portal section

## 9. Tests

| # | What | Command / harness | Result |
|---|---|---|---|
| 1 | TypeScript | `npm run typecheck` | **PASS** (exit 0) |
| 2 | ESLint | `npm run lint` | **PASS**: 0 errors, 1 pre-existing warning (`postcss.config.mjs`) |
| 3 | Unit + engine tests (Phase 3's 46 + 21 new portal tests) | `npm run test:booking` | **PASS 67/67** |
| 4 | Mutation check: ownership checks removed from `customer.ts`, then restored | `node --test tests/booking/portal.test.ts` | Correctly **FAILED 2** (A reads B's booking; B files on A's booking); passes after restore |
| 5 | Customer portal E2E: real server, Auth emulator, local E2E store; security + UI at 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px | harness `portal-e2e.mjs` | **PASS 89/89** (final run; earlier runs found the issues listed below) |
| 6 | Portal with the **real Firestore adapter** while Firestore is unreachable (error states) | harness `portal-failure.mjs` | **PASS 8/8** |
| 7 | Booking UI (Phase 3 regression) | harness `booking-ui.mjs` | **PASS 31/31** |
| 8 | Booking API (Phase 3 regression) | harness `booking-api.mjs` | **PASS 23/23** |
| 9 | Auth E2E (Phase 2 regression) | harness `auth-e2e.mjs` | First run **22/23** (1 fail, 2 dependent checks skipped) → rerun **25/25** (see note) |
| 10 | Password reset / session (Phase 2.1 regression) | harness `reset-e2e.mjs` | **25/26**: the known same-second Firebase revocation limit (Phase 2.1 report) |
| 11 | Sign-out revocation | harness `logout-check.mjs` | **PASS 3/3** |
| 12 | Super Admin foundation | harness `admin-e2e.mjs` | **PASS 9/9** |
| 13 | Public site interactions, home/gallery/book layout, hero video | harnesses `interact.mjs`, `qa.mjs` | **PASS**: no console errors, no overflow, no broken images, hero film playing |
| 14 | Storage rules | `firebase emulators:exec --only storage … --only=storage` | **PASS 3/3** |
| 15 | Firestore rules (incl. 6 new Phase 4 tests) | `npm run test:rules` | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 16 | Booking engine on real Firestore | `npm run test:booking:firestore` | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 17 | Production build, no env vars | `npx next build` | **PASS** (exit 0). Unconfigured server: portal routes redirect to sign-in (307, with `next`); both new APIs return 503 |

**Test #5 covers:**
- Signed-out users (and a forged cookie) are redirected from `/account`, `/account/bookings`, `/account/profile` and a detail URL.
- Both APIs return 401 without a session and 403 for cross-site requests.
- **A sees only A's bookings.** B's booking URL shows "Booking not found" to A, with none of B's data. B can open B's own booking.
- **A cannot file a request on B's booking** (404).
- A client-sent `customerId` is rejected, and so are attempts to change **status, payment received, pricing, admin notes and ownership**.
- Completed bookings refuse requests.
- A cancellation request is created, a duplicate is idempotent and a second one is refused. **The booking stays Confirmed and its slot stays booked** (lock untouched).
- The profile API refuses `role`, `uid`, `email`, `emailVerified` and `createdAt`. A's update does not touch B, and A's session has no role claim.
- **Dashboard:** real counts; next event; quick actions; the verified WhatsApp number only.
- **List:** text status badges; totals only when priced; the request flag; filters.
- **Details:** facts; menu; no invented services; full pricing breakdown for the priced booking; "Pricing pending" for the unpriced one; receipts empty state; timeline with real steps only.
- **Change request in the browser:**
  - the "already requested/booked" flag for a taken date;
  - over-capacity refused;
  - a triple click sends **one** request;
  - the history shows the changes;
  - the booking is unchanged.
- **Cancellation:** requires the confirmation box, and the booking is not cancelled.
- **Profile:** saved and shown after reload.
- **Email change (Auth emulator):**
  - the link goes to the new address;
  - the old email keeps working until confirmation;
  - confirming changes the email, the new email signs in, the old one no longer does, and **the old session is rejected**.
- **Empty states:** for a customer with no bookings, the empty state is not an error, and that customer cannot open A's booking.
- **Accessibility and layout:**
  - reduced motion turns the skeleton pulse off;
  - Tab reaches the booking cards with a visible focus ring;
  - **at every width: no horizontal overflow, no clipped cards, no text under 12 px, no touch target under 40 px**;
  - no unexpected console errors.

**Note on #9:**
- The first run after the dashboard change failed only "Google button opens the sign-in popup", so the 2 Google checks that depend on it did not run (22/23 recorded).
- Cause: the previous step clicked "Sign out" before the page's buttons were interactive on this heavily loaded machine, so `/login` redirected back to `/account`.
- The immediate rerun passed 25/25. No assertion was changed.

**Found and fixed during this phase:**
- **Dashboard blocked on the database:** with a slow or unreachable database, the account status and sign-out waited for the bookings query. The bookings part is now streamed separately.
- **Session check after streaming:** portal pages streamed before the session check, so an expired or forged cookie got a client-side redirect. The check now runs in the layout first (a real 307).
- **Local E2E store split across bundles:** Next.js bundles routes separately, so the local E2E store needs one shared instance (`globalThis`). This affected only the test mode.
- **Layout:** 11 px eyebrow labels on portal pages were raised to 12 px, and a full-width status badge at 320 px was fixed.

## 10. Known limitations

- **Firestore emulator blocker (from Phase 3, unresolved):**
  - the Firestore rules (including the new `bookingRequests` and `phone` tests) and the engine/request transactions on real Firestore have **not** been executed;
  - the portal's data logic was tested against the in-memory store, which follows Firestore's transaction rules, and against the real adapter only in its failure path.
- **Not-found status:** because the portal streams, "Booking not found" is HTTP 200 + `noindex` (see §4). There is no data leak.
- **Requests can't be reviewed yet:** there is no admin UI to accept or decline requests (future phase). Until then they are visible only in the Firebase console, and customers are told the team will contact them.
- **Receipts** are a placeholder state: there is no payment or receipt data model yet.
- **Customer-side extras:** customers cannot withdraw a request or cancel directly (by design); withdrawing could be added with the admin phase.
- **Email change** is offered for email/password accounts only. Google accounts' email belongs to Google.
- **Firestore email mirror:** `users.email` is updated to the new Auth email when the customer next opens their profile after signing in again.
- **Pricing:** the prices and terms from Phase 3 are still unconfirmed, so customers see "Pricing pending". The priced view was tested only with TEST-ONLY prices in emulator data.

## 11. Remaining Firebase verification (on a machine where the Firestore emulator runs, or before launch)

1. Rules tests, which now also cover `bookingRequests` and the `phone` field:

   ```bash
   npm run test:rules
   ```

2. Engine tests on real Firestore transactions:

   ```bash
   npm run test:booking:firestore
   ```

3. Deploy the rules and indexes once the real project exists (no new index was added in Phase 4):

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

4. In the Firebase Console, set the custom **email action URL** to `https://<domain>/auth/action`, so the verify, reset, **verify-and-change-email** and **recover-email** links open this site.
5. Check that Firebase Authentication's email templates for "email address change" are enabled.

## 12. Future dependencies (what Phase 5 will need)

- **Admin review of `bookingRequests`:** accept or decline. Accepting a modification should run the Phase 3 engine: claim the new slot atomically, release the old one, re-price and snapshot. Accepting a cancellation uses `changeBookingStatus(…, "cancelled")`. Set `decidedAt` and the status.
- **Payment records and receipts:** the data model and admin entry, so that `advanceReceived`, `balanceDue` and the receipts section show real data.
- **Pricing:** the real price list (`PRICING_CONFIG`) and the business confirmations still open from Phase 3 (slot times, hall name, event types, services, hold hours, cancellation policy).
- **A scheduled job** to mark pending requests with lapsed holds as `expired` (optional; availability already treats them as free).
- **Hosting:** rate limiting of the public availability API.
