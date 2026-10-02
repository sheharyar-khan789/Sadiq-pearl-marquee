# Sadiq Pearl Marquee — Phase 5 Report (Super Admin Panel & Booking Management)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Protected `/admin` area: dashboard, bookings list, booking review with confirm / reject / cancel / complete, customer modification and cancellation decisions, manual (walk-in / WhatsApp / phone / other) bookings, calendar, customers, internal admin notes, audit trail |
| Not built (future phases) | Payments and receipts, quotations, vendors, menus, packages, decoration builder, service pricing management, notifications, WhatsApp automation, reports, CMS, an audit-log viewer beyond the per-booking history |
| Data | **No production data was written.** No real Firebase project is connected. Tests used the Auth emulator, the in-memory transactional test store and emulator-only accounts. |

> **Firestore emulator — still an environment blocker.** It still fails to start on this machine: the Java process cannot open a loopback socket, and this was confirmed again in Phase 5. Therefore:
> - `npm run test:rules` (now including 3 new Phase 5 rules tests) is **NOT EXECUTED — ENVIRONMENT BLOCKER**.
> - `npm run test:booking:firestore` (now also including `tests/firestore/admin.firestore.test.ts`, the admin concurrency scenarios on the real Firestore adapter) is **NOT EXECUTED — ENVIRONMENT BLOCKER**.
>
> **No real Firestore result is claimed.**

---

## 1. Implemented

- **`/admin` Super Admin area** with its own layout and navigation: Dashboard, Bookings, Calendar, Customers, plus "New booking".
- **Dashboard.** All figures come from the database:
  - today's Day and Night events (customer, event type, guests, status, reference) or an empty state;
  - counts: upcoming, pending, under review, confirmed upcoming, open change requests;
  - slots in the next 30 days (free / on hold / booked), computed by the same availability engine as the public page;
  - the waiting booking requests and the open customer change requests.

  Payments: **"Payment data not configured"**. No revenue, advance or balance figures are shown or estimated.
- **Bookings list (`/admin/bookings`):**
  - searchable by reference, customer name, email and phone;
  - filterable by date range, status, slot, source and event type;
  - sortable by event date (either direction) or newest submitted;
  - paged 25 per page, all on the server;
  - shown as a table on wide screens and as cards on phones.
- **Booking review (`/admin/bookings/[id]`):**
  - customer (name, email, phone, account link or "offline customer");
  - event (date, hall, slot with its **current** state, type, guests, source);
  - services and menu only when stored;
  - pricing only when real, otherwise "pricing pending";
  - customer notes;
  - **status actions** (each behind a confirmation dialog);
  - the customer's **change and cancellation requests**, with approve / reject;
  - **internal admin notes**;
  - the timeline and the **admin history** (audit).
- **Manual booking (`/admin/bookings/new`):**
  - for walk-in, WhatsApp, phone or other bookings, for an offline customer (no account and no credentials) or an existing online account;
  - the form shows the slot's live state;
  - it is saved through the **same engine transaction and slot locks** as website bookings.
- **Calendar (`/admin/calendar`):**
  - a month grid with a Day/Night state for every date (○ free, ◐ on hold, ● booked, – closed, plus text labels);
  - clicking a date shows both slots with the booking (customer, event, guests, status, reference);
  - it uses **the same `getAvailability` engine** as the public `/book` page.
- **Customers (`/admin/customers`, `/admin/customers/[uid]`):**
  - Firebase user profiles (`users/{uid}`) plus the offline contacts found on staff-entered bookings, with booking counts and the latest booking;
  - the detail page shows the profile and upcoming / past bookings;
  - no passwords or sign-in details can be viewed or changed.
- **Audit trail:** `adminAudit/{id}` records for confirm, reject, cancel, complete, under review, admin-notes update (the note's length only, not its text), modification approved or rejected, cancellation approved or rejected, and manual booking created.
  - Each record holds the action, the admin's uid and email, the booking, the request, a small before/after summary, the reason and the time.
  - It is written **in the same transaction** as the change it describes.

## 2. Admin architecture

- **Pages:** `src/app/(admin)/layout.tsx` plus the `src/app/(admin)/admin/*` pages. They are server components that read data through `src/lib/booking/admin-server.ts`.
- **Actions:** small client components post to four admin API routes. Each route runs `adminMutation()` (`src/lib/booking/admin-api.ts`): **Super Admin check → JSON parse → the engine/admin transaction → a clear error message**.
- **Domain logic:**
  - `src/lib/booking/admin.ts`: status actions, notes, manual-booking validation, request decisions;
  - `src/lib/booking/engine.ts`: `changeBookingStatus`, strengthened; `createManualBooking`, now audited;
  - `src/lib/booking/admin-view.ts`: rows, filters, pagination, customer aggregation.
- **Storage:** Admin SDK only, through the `BookingStore` interface.
  - New admin reads: a date range (`eventDate` range, automatic single-field index), status "in", `getAll`, open requests, requests per booking, audit per booking.
  - **No new composite index** is needed. All new queries are single-field ranges or equalities, sorted in memory.
  - The list query always covers a **bounded date window** (at most 400 days, at most 3,000 rows), so the whole booking history is never loaded.

## 3. Authorization

- **Who is a Super Admin:** a verified session cookie (signature, expiry, **revocation**), plus the **server-set custom claim** `role: "super_admin"` (Phase 2 `scripts/set-super-admin.mjs`; never from Firestore or the browser), plus a **verified email**.
- **Pages:**
  - the `(admin)` layout calls `requireSuperAdmin()` **before anything renders or streams**; there is no session → redirect to sign-in; a customer, or an admin claim with an unverified email → **404**, so the admin area is not revealed (Phase 2 decision);
  - because Next.js renders layouts and pages concurrently, **every admin data loader checks the Super Admin again** before any query, so no admin query ever runs for anyone else (found and fixed in this phase).
- **APIs:** `requireSuperAdminApi()` on every admin route. Cross-site → 403; no or expired session → 401; not a Super Admin (or email unverified) → 403.
- There is **no shared admin password**. No role is read from Firestore or client state. Admin links being hidden in the UI is not what provides the security.

## 4. Booking management (approve / reject / cancel / complete)

`changeBookingStatus` (engine) is the only place a status changes. It runs **one transaction**:

1. Read the booking.
2. **Stale check:** if its `updatedAt` differs from what the admin saw → `stale`, and nothing changes.
3. Check the transition against the Phase 3 `STATUS_TRANSITIONS` map. Admins may choose `under_review`, `confirmed`, `rejected`, `cancelled` and `completed`; `expired` is system-only. "Completed" is refused before the event date.
4. Read the slot lock **now**.
   - **Confirm / under review:** the lock must belong to this booking, or be free (it is then claimed), or be an **expired** pending hold of another request (it is taken over and that request is marked `expired`). If another active booking holds it → `slot_unavailable`, and nothing changes.
   - **Reject / cancel:** the lock is deleted (the slot is released), the booking's open change requests are closed, and the record is **kept** (never deleted).
5. Update the booking status and timestamp, and write the audit record.

**Pending-hold policy unchanged:** 48 hours (`bookingPolicy.pendingHoldHours`, checked by a test). Expired holds never block availability. No background clean-up job was added: a lapsed pending request stays "pending (hold lapsed)" until staff act on it or another booking takes the slot.

## 5. Modification approval (atomic)

`decideRequest(…, "approve")` for a modification is one transaction:

1. **Reads:** the request (it must still be `open`), the booking (it must be active, and not stale), the **old slot lock**, the **requested slot lock**, and the booking holding the requested slot if its hold has expired.
2. **Checks:**
   - the requested date is not past and is within the booking window;
   - capacity; menu and services;
   - **the requested slot is free, or held by an expired pending request.**
3. **Writes, all together:**
   - **claim the new slot** (create the lock, or replace it with a `lastUpdateTime` precondition);
   - **update the booking** (date, slot, guests, menu, services, and the customer's decoration / notes appended);
   - **release the old slot** (delete with a precondition);
   - mark a displaced lapsed request `expired`;
   - **close the request** (`accepted`, `decidedAt`, `decidedBy`, `decisionReason`);
   - write the audit record with before/after.
4. **If the requested slot is taken:** `slot_unavailable`. **The booking, its old slot and the request stay exactly as they were.**
5. **Pricing:**
   - if anything price-relevant changed, the booking is re-quoted with the configured price list;
   - with no real prices (the current state), `pricing` becomes `null` ("pricing pending") and the payment amounts become `null`;
   - `advanceReceived` is preserved;
   - no totals are invented.
6. A pending request that staff move gets a fresh hold of the same 48 hours, so its new slot is actually held.

## 6. Cancellation handling

- **Customer cancellation request → approve:** one transaction:
  - the booking is set to `cancelled` (with the `cancelledAt` timestamp);
  - its slot lock is deleted;
  - the request is accepted;
  - other open requests for that booking are closed;
  - an audit record is written.
- **Reject:** the request is declined, and the booking is untouched.
- **Staff can also cancel** a confirmed booking directly (status action, with a confirmation dialog and an optional reason).
- **No cancellation or refund policy was invented.** The dialogs say "No refund is calculated (policy not configured)".

## 7. Manual booking

- `POST /api/admin/bookings` → `validateManualBooking`.
  - It uses the same checks as website requests: date, past date, booking window, hall, slot, event type, capacity, contact, menu, notes, request key.
  - Plus: `source` must be walk-in, WhatsApp, phone or other (not `website`); `status` must be pending or confirmed; an optional existing `customerId`, verified to exist; an optional email.
- Then `createManualBooking` runs through **the same `createBooking` transaction and slot locks** as the website, with `createdBy: {kind: "admin"}`. It is audited.
- **Offline customers:**
  - the booking stores their contact snapshot with `customerId: null`;
  - **no Auth account and no credentials are created**, and nothing is emailed or texted;
  - they appear under Customers as "offline", grouped by phone.
  - Future workflow: link them to an online account after the customer verifies the same phone or email.
- The same request key is idempotent: a double-click creates one booking.

## 8. Calendar

- Month view from `getAvailability(store, hall, from, to)`, the **same function** that serves the public `/api/availability`. There is no second availability algorithm.
- The booking detail for a date comes from that month's slot locks and bookings (admin only).
- The E2E test checks that a calendar cell matches the public availability API.

## 9. Customer management

- **Customers = `users/{uid}` profiles** (Admin SDK) **+ offline contacts** found on staff bookings. There is **no separate customer database**.
- Booking counts and the latest booking come from bookings in a ±2-year window.
- The customer detail uses the Phase 4 `listBookingsForCustomer`.
- Admins cannot change passwords or authentication details (Firebase Auth owns them).

## 10. Security

- **Admin notes:**
  - written only through the admin API;
  - never included in customer views: `toCustomerView` excludes them, and a unit test plus an E2E test check the customer's own booking page after notes were saved;
  - the audit stores only the length of the notes.
- **Firestore rules:**
  - added `adminAudit/*`: `allow read, write: if false`;
  - `bookings`, `slotLocks` and `bookingRequests` stay closed to browsers;
  - nothing is opened for the admin, because the admin works only through server routes with the Admin SDK. Service-account credentials stay server-only.
- **Errors:** clear admin messages for slot taken, modification conflict, invalid transition, stale page, missing booking or request, unknown customer, database failure or timeout (503, "nothing is shown as saved"), network failure and expired session. Database errors are logged as codes only, and are never swallowed or turned into success.

## 11. Concurrency protection

All admin writes are Firestore transactions with the Phase 3 preconditions:
- `create()` fails if the document exists;
- `update` / `delete` with `lastUpdateTime` fail if the document changed.

Concurrent operations on the same booking or slot therefore conflict. One commits; the other is retried against the new state and then refuses (`slot_unavailable`, `invalid_transition`, `not_open`, `not_allowed`), leaving consistent data.

## 12. Files changed

**New**
- `src/lib/booking/audit-model.ts`, `admin.ts`, `admin-view.ts`, `admin-server.ts`, `admin-api.ts`
- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/admin/`: `page.tsx`, `loading.tsx`, `bookings/page.tsx`, `bookings/new/page.tsx`, `bookings/[bookingId]/page.tsx`, `calendar/page.tsx`, `customers/page.tsx`, `customers/[uid]/page.tsx`
- `src/app/api/admin/bookings/route.ts`, `bookings/[bookingId]/status/route.ts`, `bookings/[bookingId]/notes/route.ts`, `requests/[requestId]/decision/route.ts`
- `src/components/admin/`: `AdminUi.tsx`, `AdminNav.tsx`, `ConfirmDialog.tsx`, `BookingActions.tsx`, `RequestDecision.tsx`, `AdminNotesForm.tsx`, `ManualBookingForm.tsx`
- `tests/booking/admin.test.ts`, `tests/firestore/admin.firestore.test.ts`
- `SADIQ_PEARL_PHASE_5_REPORT.md`

**Modified**
- `src/lib/booking/engine.ts`: stale check, slot re-claim, open-request closing and audit in `changeBookingStatus`; audited manual bookings; exported `lockFor` / `auditRecord`
- `src/lib/booking/store.ts`, `firestore-store.ts`, `testing/memory-store.ts`: admin reads, `updateRequest`, `createAudit`
- `src/lib/booking/request-model.ts`: optional `decidedBy`, `decisionReason`
- `src/lib/booking/server.ts`: E2E seed also seeds profiles
- `src/lib/account/profile.ts`, `firestore-profile-store.ts`: `list()` (admin)
- `src/lib/auth/server.ts`: `requireSuperAdminApi()`
- `src/app/api/auth/session/route.ts`: sign-out waits out the same-second revocation gap (≤ ~1 s)
- `firestore.rules`: `adminAudit` closed
- `scripts/test-security-rules.mjs`: 3 new tests
- `package.json`: the Firestore suite runs every file in `tests/firestore/`
- `README.md`: admin section

## 13. Tests

Environment key:
- **Unit/in-memory**: Node's test runner with the in-memory transactional store (Firestore-like transaction rules; not Firestore).
- **Browser/E2E**: headless Chrome + the production build (`next start`) + the **Auth emulator** (real session cookies and custom claims). Booking data comes from either the **local in-memory test store** (seeded with the real engine functions) or the **real Firestore adapter with Firestore unreachable** (to test failure paths).
- **Real Firestore** / **Firestore emulator**: none executed (blocker).

| # | What | Command / harness | Environment | Result |
|---|---|---|---|---|
| 1 | TypeScript | `npm run typecheck` | local | **PASS** (exit 0) |
| 2 | ESLint | `npm run lint` | local | **PASS**: 0 errors, 1 pre-existing warning (`postcss.config.mjs`) |
| 3 | Booking + portal + **admin** unit tests: 67 earlier + 26 new admin tests, including **6 concurrency tests** (4 of them repeated 10× each) | `npm run test:booking` | in-memory | **PASS 93/93** |
| 4 | Mutation checks (see below) | `node --test tests/booking/admin.test.ts` | in-memory | Each mutation made the expected tests **FAIL**; everything passes after restoring |
| 5 | Admin concurrency on the **real Firestore adapter** | `npm run test:booking:firestore` (`tests/firestore/admin.firestore.test.ts`) | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** (emulator "Fatal error"; the file loads and reaches the connection) |
| 6 | Booking engine on the real Firestore adapter (Phase 3 suite) | `npm run test:booking:firestore` | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 7 | Firestore rules (including 3 new Phase 5 tests for `adminAudit` and direct booking writes) | `npm run test:rules` | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 8 | Storage rules | `firebase emulators:exec --only storage … --only=storage` | Storage + Auth emulator | **PASS 3/3** |
| 9 | **Admin panel E2E**: authorization, workflows, API races, 7 widths | harness `admin-panel-e2e.mjs` | Browser + Auth emulator + in-memory test store | **PASS 68/68** (final run; earlier runs: see "Found and fixed") |
| 10 | Admin pages/API with the database unreachable | harness `admin-failure.mjs` | Browser + Auth emulator + **real Firestore adapter**, Firestore unreachable | **PASS 6/6** |
| 11 | Customer portal (Phase 4 regression) | harness `portal-e2e.mjs` | Browser + Auth emulator + in-memory | **PASS 89/89** |
| 12 | Portal failure states | harness `portal-failure.mjs` | real adapter, Firestore unreachable | **PASS 8/8** |
| 13 | Booking UI (Phase 3 regression) | harness `booking-ui.mjs` | Browser, availability/booking API responses supplied by the harness | **PASS 31/31** |
| 14 | Booking API (Phase 3 regression) | harness `booking-api.mjs` | Auth emulator + real adapter, Firestore unreachable | **PASS 23/23** |
| 15 | Auth E2E (Phase 2 regression) | harness `auth-e2e.mjs` | Browser + Auth emulator | First run **22/23** (the known "sign-out clicked before the page was interactive" timing flake, so 2 dependent Google checks did not run); after rebuild **25/25** |
| 16 | Password reset / session (Phase 2.1 regression) | harness `reset-e2e.mjs` | Browser + Auth emulator | Before the sign-out fix **25/26**; after it **26/26** (first time this check ever passed) |
| 17 | Sign-out revocation | harness `logout-check.mjs` (run twice) | Auth emulator | Before the fix one run showed the gap=0 case **STILL ACCEPTED**; after it **6/6 REJECTED** |
| 18 | Super Admin foundation (Phase 2) | harness `admin-e2e.mjs` | Auth emulator | **PASS 9/9** |
| 19 | Public site: interactions, home / gallery / `/book` / login layout, hero video | harnesses `interact.mjs`, `qa.mjs` | Browser | **PASS**: no console errors, no overflow, no broken images, hero film playing |
| 20 | Production build, no env vars | `npx next build` | local | **PASS** (exit 0; no database access during the build). Unconfigured server: `/admin*` redirects to sign-in (307); admin API returns 401 without a session |

**Mutation checks (#4):**
1. Removing the "requested slot is active → refuse" check from modification approval made the **modification race** and **taken-slot** tests fail.
2. Removing the "another active booking holds the lock → refuse" check from `changeBookingStatus` made the new **defence-in-depth** test fail. That test was added because no existing test covered this path, which can only occur with inconsistent data.

**What #3 and #9 prove:**
- **Authorization:**
  - Signed-out users are redirected from all 7 admin pages.
  - A customer, an admin claim with an unverified email, and a forged cookie are all refused on every page (404 / 404 / 307).
  - The customer's 404 leaks no admin data.
  - All 4 admin APIs return: no session 401, customer 403, unverified admin 403, cross-site 403.
- **Rules enforced on the server:**
  - invalid action 400, invalid transition 409, stale page 409, missing booking 404;
  - a modification to a taken slot returns 409 and the other booking keeps its slot;
  - manual booking with source "website" 400; unknown customer account 404.
- **Races through the real HTTP APIs:** two simultaneous confirmations → exactly one; manual vs website booking for the same slot → exactly one.
- **Dashboard:** today's Day/Night events; "Payment data not configured"; KPIs from the data.
- **Bookings list:** filter, search, source + slot.
- **Workflows in the browser:**
  - confirm through a dialog (nothing is sent before confirming; exactly one call; audit shows the admin's email);
  - **admin notes never appear in the customer's pages**;
  - reject with a reason (slot released, history kept);
  - approve a modification (booking moved; new slot booked, old released);
  - approve a cancellation (slot released; the dialog says no refund is calculated);
  - walk-in created through the engine (a double-click creates one booking; a taken slot is refused with a clear message).
- **Calendar and customers:**
  - calendar date detail;
  - a calendar cell matches the public availability API;
  - customers list (online + offline) and customer detail (no password management).
- **Layout and keyboard:**
  - **at every width: no page overflow, no text under 12 px, targets at least 40 px**;
  - the dialog focuses "Go back" first, and Escape closes it without acting;
  - no console errors.

**Found and fixed during this phase:**
1. **Admin data queries ran before the admin check.** Next.js renders layouts and pages concurrently, so admin page loaders ran even for non-admins, and during the build. Their output was never sent, but the queries ran. **Every admin loader now verifies the Super Admin itself.**
2. **Sign-out missed a same-second session.** A session created in the same second as sign-out stayed valid, because Firebase stores revocation to the whole second (the long-standing Phase 2.1 edge case). Sign-out now waits, at most about 1 s, until that second has passed before revoking.
3. Two small touch targets and the calendar month buttons at 320 px were enlarged or shortened.
4. **Test harness:** the Auth emulator ignores custom claims on account creation, so the harness now sets them with `accounts:update`, the same call `setCustomUserClaims` makes. A case-sensitive text check was also fixed. No assertion was loosened.

## 14. Known limitations

- **Firestore emulator blocker (from Phase 3):** rules and transaction behaviour on real Firestore are **not verified** here. Run both commands in §15 on a machine where the emulator starts, before launch.
- **Admin history only:** no audit-log viewer beyond the per-booking history (by design for this phase).
- **Lapsed requests aren't auto-expired:** a lapsed pending request is not marked `expired` automatically (no scheduled job). The panel shows "hold lapsed", and availability already treats it as free.
- **Bounded windows:** the admin list covers a bounded date window (at most 400 days per query) and the customers page ±2 years of bookings. This suits a one-hall venue (at most 2 events a day); a very long history would need an archive or search index later.
- **Offline customers** are grouped by phone digits; there is no merge tool or account-linking flow yet.
- **Soft 404 for customers:** as in Phase 4, the customer portal's not-found is a soft 404.
- **Soft 404 for a missing booking in admin:** refusals of non-admins are real 404s (layout check before streaming), but a missing booking inside the admin area is also a streamed soft 404.
- **Sign-out may take up to ~1 s** when it happens within a second of signing in (security fix above).
- **Payments and receipts:** payment management and receipts are not built; payment figures appear only when real data exists (none yet).

## 15. Business information still required

- **Real prices:** hall rent, per-guest rate, advance share. Until then everything shows "pricing pending".
- **Cancellation and refund policy.** Admin cancellation currently just releases the slot.
- Slot times, the final hall name, the final event types and the services list (still open from Phase 3).
- Confirmation of the 48-hour pending hold, and whether same-day requests are allowed.
- **Who the Super Admin(s) are.** Grant with:

  ```bash
  node --env-file=.env.local scripts/set-super-admin.mjs <email>
  ```

  The account's email must be verified.
- Once the real Firebase project exists:

  ```bash
  npm run test:rules
  ```

  ```bash
  npm run test:booking:firestore
  ```

  ```bash
  firebase deploy --only firestore:rules,firestore:indexes
  ```
