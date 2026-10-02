# Sadiq Pearl Marquee — Phase 3 Report (Booking & Availability Engine)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Booking data model, slot/hall/status definitions, availability engine, transaction-safe double-booking protection, secure booking-request API, first customer booking page |
| Not built (future phases) | Customer dashboard / My Bookings, admin dashboard or calendar, manual-booking UI, cancellation/modification workflow, payments, receipts, quotations, menus/packages/decor/vendor management, notifications, reports, CMS |
| Data | **No bookings were written to any real database.** No real Firebase project is connected. All tests used an in-memory test store, the Auth emulator, or responses supplied by the test harness. |

> **Environment blocker:** as in Phase 2 and 2.1, the **Firestore emulator cannot start on this machine**. Its Java process cannot open a loopback socket; this was tried with JDK 17, JBR 21 and JDK 25.
> - The booking engine's double-booking logic **was** executed and passes against an in-memory store that follows Firestore's transaction rules (§10).
> - The same scenario suite against the **real Firestore adapter on the emulator** is written and ready: `npm run test:booking:firestore`. It is **NOT EXECUTED — ENVIRONMENT BLOCKER**, so it must be run on a machine where the emulator starts before real launch.

---

## 1. Implemented

- **Central catalog** (`src/lib/booking/catalog.ts`):
  - **one hall**, `main-hall` (capacity **1,000**);
  - **two slots**, `day` and `night`, each with an ID, label, start/end time (null = not confirmed) and an enabled flag;
  - event types, add-on services (empty) and menu options (from the printed card).
- **Controlled booking statuses** (`status.ts`): `pending`, `under_review`, `confirmed`, `completed`, `cancelled`, `rejected`, `expired`.
  - It defines which statuses occupy a slot and which transitions are allowed.
- **Booking data model** (`model.ts`): `bookings/{bookingId}`, plus a **unique slot lock** `slotLocks/{YYYY-MM-DD__hallId__slotId}`.
- **Availability engine** (`availability.ts`, `engine.ts#getAvailability`): one pure rule, with each date shown as available / partial / unavailable / past / closed. Each slot is shown as available / held / booked / closed.
- **Transaction-safe booking creation** (`engine.ts`):
  - the booking and its slot lock are written atomically;
  - duplicate submissions are idempotent;
  - there is a per-customer limit on open requests;
  - a request whose temporary hold has expired can be taken over safely.
- **Status changes** (`changeBookingStatus`): these keep the slot lock in step (holding statuses keep it, and cancel/reject/expire release it). This is for future admin tools; there is no customer endpoint for it.
- **Manual/walk-in booking foundation** (`createManualBooking`): for `walk_in`, `whatsapp`, `phone` and `other` sources, using the same slot locks. There is no UI for it (future admin phase).
- **Pricing architecture** (`pricing.ts`):
  - the configuration is separate from the calculation, and the calculation is pure;
  - a price snapshot is stored on the booking;
  - no prices are invented. Nothing is priced until the real prices are configured.
- **Server APIs:**
  - `GET /api/availability` (public; returns only free/held/booked);
  - `POST /api/bookings` (signed-in customers with a verified email only).
- **Customer booking page `/book`:**
  - month calendar → Day/Night slot → event details → review → submit;
  - it shows the reference number;
  - it handles every error case and cannot double-submit.
- **Entry points:**
  - a "check free dates and request online" link in the existing inquiry modal;
  - a "Check availability" button on `/account`;
  - `/book` in the sitemap.
- **Firestore rules** explicitly close `bookings` and `slotLocks` to browsers.
- **Firestore indexes** were added for the two queries the engine uses.

## 2. Booking data model

`bookings/{bookingId}`, written only by the server (Admin SDK):

| Field | Notes |
|---|---|
| `schemaVersion` | `1` |
| `bookingId` | `bk_` + 24 hex. Derived from the creator's uid and the form's request key (see §4). |
| `customerId` | Firebase uid **taken from the verified session**. `null` for a walk-in without an account. |
| `customer` | `{ name, phone, email }`, a snapshot of the contact details for this booking. |
| `createdBy` | `{ kind: "customer" \| "admin", uid }` |
| `source` | `website`, `walk_in`, `whatsapp`, `phone` or `other` (a website request is always `website`). |
| `eventDate` | `YYYY-MM-DD` in the venue's time zone. |
| `hallId`, `hallName` | A stable ID plus a name snapshot. |
| `slotId`, `slotLabel` | A stable ID plus a label snapshot. |
| `slotKey` | `2026-10-20__main-hall__day` |
| `eventTypeId`, `eventTypeLabel` | A stable ID plus a label snapshot. |
| `guestCount` | An integer from 1 to the hall's capacity. |
| `services` | `[{ id, label }]`, a snapshot of the selected add-ons (none are configured yet). |
| `menuPreference` | `{ id, title }` or `null`, from the printed menu card. |
| `pricing` | A `PricingSnapshot` (price-list version, lines, subtotal, service charge, total, advance, calculatedAt), or `null` until prices exist. |
| `payment` | `{ currency: "PKR", advanceRequired, advanceReceived (0), balanceDue }`. The amounts are `null` until the booking is priced. |
| `status` | One of the 7 controlled statuses. |
| `holdExpiresAt` | Set only for `pending` (see §5). |
| `customerNotes` | Up to 1,000 characters. |
| `adminNotes` | Internal. Starts empty and is never shown to or accepted from customers. |
| `timeline` | `submittedAt`, then `reviewedAt` / `confirmedAt` / `completedAt` / `cancelledAt` / `rejectedAt` / `expiredAt` as each is reached. |
| `createdAt`, `updatedAt` | Server time. |

`slotLocks/{date__hall__slot}` holds `{ slotKey, date, hallId, slotId, bookingId, status, holdExpiresAt, updatedAt }`.
- It exists only while a booking occupies the slot.
- It holds **no customer data**, so availability never needs to read bookings.

The model is ready for future cancellation/modification requests and history:
- `timeline`, `status` and the transition table are in place;
- a history log or a request sub-collection can be added without changing any existing field.

A separate "decoration selections" field was **not** added. Decoration will be an add-on service once the venue confirms its services, so it needs no field of its own.

## 3. Availability logic

- There is one rule, `slotStateFor(lock, now)`:
  - no lock (or an expired pending hold) = **available**;
  - `pending` or `under_review` = **held**;
  - `confirmed` or `completed` = **booked**.
- **Date status:**
  - both slots available = `available`;
  - one available = `partial`;
  - none available = `unavailable`;
  - before today = `past`;
  - beyond the booking window = `closed`.
- **Performance:** one query per month, `slotLocks where hallId == X and date between from and to` (at most 62 days).
  - It reads only lock documents, never the booking collection, and nothing is computed from bookings in the browser.
- The UI only displays what the server returns. Only the server decides whether a request succeeds.

## 4. Double-booking protection

**What it guarantees:** at most one active booking per **date + hall + slot**, enforced in the database transaction, not by the UI.

1. The customer submits. The server validates the request, then runs **one Firestore transaction**, which:
   - reads `bookings/{bookingId}`; if it exists, this is a duplicate submission and the existing booking is returned;
   - reads `slotLocks/{slotKey}`; if it is active, the result is `slot_unavailable` (HTTP 409);
   - if the lock is an **expired** pending hold, reads that old booking so it can be marked `expired`;
   - counts the customer's open requests (limit: 3);
   - then **writes** the booking with `create()` (fails if it exists) and the lock:
     - `create()` if no lock existed (fails if one appears meanwhile);
     - otherwise `update()` with a **`lastUpdateTime` precondition**, so it fails if the lock changed since it was read.
2. **Why two simultaneous customers can't both win:**
   - Both transactions read the same lock document.
   - Firestore commits at most one of them. The other is aborted and retried, then sees the lock and returns `slot_unavailable`.
   - Independently of the transaction, the `create()` precondition on the lock document also makes a second claim fail.
3. **Idempotency:**
   - `bookingId = sha256(creatorUid + requestKey)`. The browser makes one random `requestKey` per submission and reuses it only when retrying the same details after a network error or timeout.
   - A double-click, a retry, or a response lost on the way back can never create a second booking.
   - Another user cannot produce the same ID, because it includes the uid.

What was **executed**:
- The scenario suite ran against `MemoryBookingStore`, which enforces Firestore's rules: reads before writes, commit-time conflict detection with retry, and `create`/precondition failures. Every read yields to the event loop, so racing requests really interleave.
- 2 simultaneous customers: exactly 1 succeeded.
- 10 simultaneous customers: exactly 1 succeeded.
- Transaction retries were observed.
- **Mutation check:** with the slot check removed from the engine, 7 tests failed, including both race tests. The tests do detect double booking.

Not executed here: the same suite against the real Firestore adapter (§10).

## 5. Slot logic and status rules

- The slots are `day` and `night`, from `SLOTS` in `catalog.ts`. No `"day"`/`"night"` strings appear elsewhere; everything imports `SlotId` or `getSlot`.
- **Slot times are not set** (`null`). The UI shows "Timing to be confirmed".
- **Which statuses occupy the slot** (`SLOT_HOLDING_STATUSES`):

| Status | Occupies the slot? |
|---|---|
| `pending` | **Temporarily**: until `holdExpiresAt` = submission + `pendingHoldHours` (48, **working value, needs confirmation**). After that it is free, and the next request marks the old one `expired`. |
| `under_review` | Yes, until the venue decides (no expiry: a person is actively handling it). |
| `confirmed`, `completed` | Yes. |
| `cancelled`, `rejected`, `expired` | No. The lock is deleted in the same transaction. |

- **Allowed transitions:**
  - `pending` → under_review / confirmed / rejected / cancelled / expired;
  - `under_review` → confirmed / rejected / cancelled;
  - `confirmed` → completed / cancelled;
  - the rest are final.
- Confirming a request whose hold has expired succeeds **only if nobody else has taken the slot**.
- This design avoids accidental permanent locking: a forgotten `pending` request frees its slot automatically after the hold.

## 6. Capacity, date and request validation

The server validates every request (`validation.ts`); the form runs the same checks only for instant feedback.

- **Date:** exactly `YYYY-MM-DD`, a real calendar date (`2026-02-30` is rejected), not before **today in `Asia/Karachi`**, and at most 730 days ahead.
  - "Today" is always computed in the venue's time zone, never the browser's or UTC. It is tested across the UTC/Pakistan midnight boundary.
- **Hall:** a known, enabled ID only. **Slot:** `day` or `night` only (`"Day"` is rejected). **Event type:** a known ID.
- **Guests:** an integer from 1 to the hall capacity (1,000). `0`, negatives, fractions, text such as `"300"`, `NaN` and `1001` are rejected. The engine repeats this check itself.
- **Contact:** a name of 2–100 characters and a phone number of 10–15 digits. **Notes:** at most 1,000 characters. **Services:** must exist (there are none yet).
- **Unknown fields are rejected** (`unexpected_field`): `customerId`, `status`, `total`, `pricing`, `advanceReceived`, `adminNotes`, `source`, `role`, `bookingId`, and so on.

## 7. Pricing architecture

- `PRICING_CONFIG` holds the configuration:
  - hall rent per hall;
  - a per-guest rate;
  - add-on prices;
  - a small-event surcharge;
  - a service-charge percentage;
  - an advance percentage;
  - a `version`.
- `quote()` is a pure calculation in whole PKR. It returns `unpriced` (with the list of missing prices) unless every needed price is configured.
- **Current state:**
  - hall rent, the per-guest rate, service prices and the advance share are **not configured**, so every booking stores `pricing: null` and null amounts;
  - the UI says "Confirmed by our team (prices aren't shown online yet)";
  - no total is ever displayed.
- The config includes the two rules from the printed terms card, with an interpretation that needs confirmation:
  - fewer than 300 guests → an extra Rs 300 per guest;
  - a 5% service charge.
- **Snapshot:** a priced booking stores its own copy of the lines and totals plus `configVersion`. A test confirms that changing the price list later leaves existing bookings unchanged.
- **The browser never sends prices;** the server calculates them.

## 8. Security

- **Authentication:**
  - `POST /api/bookings` needs a valid `__session` cookie, verified with the Admin SDK (signature, expiry, **revocation**), plus a **verified email**;
  - the customer ID comes only from that session.
- **CSRF:** same-origin `Origin` check; requests without an Origin are refused. The helper is now shared with the session route (`src/lib/auth/origin.ts`).
- **Mass assignment:** the request body may contain only the allow-listed fields (§6). Status, source, amounts, admin notes and ownership are always set by the server.
- **Firestore rules:**
  - `bookings/*` and `slotLocks/*` are `allow read, write: if false` for browsers;
  - a customer cannot read, create, confirm, re-price, re-assign or delete a booking, or create or free a lock, directly;
  - only the server (Admin SDK) writes them, inside the engine's transactions.
- **Abuse controls:**
  - at most 3 open requests per customer;
  - pending holds expire;
  - the request body is limited to 16 KB;
  - availability ranges are limited to 62 days.
- **Privacy:**
  - availability returns only free/held/booked, with no names or IDs;
  - logs contain only error codes, and were checked;
  - booking responses return only the reference, status, date, hall and slot.
- **Honest failure:**
  - database timeouts return 503 "not confirmed saved — try again" (the retry is safe because of idempotency);
  - the UI never shows success unless the server returned it.

## 9. API / server functions

| Function / route | Purpose |
|---|---|
| `GET /api/availability?hall=&from=&to=` | Public availability for up to 62 days: `{ hallId, today, days[] }`. Responses: 400 bad range or hall; 503 if the database is unavailable or not configured. |
| `POST /api/bookings` | Customer request. Responses: 201 created; 200 duplicate; 400 `invalid_request` + per-field `{code, message}`; 401 `unauthenticated` (including an expired session); 403 `forbidden` / `email_unverified`; 409 `slot_unavailable`; 413 body too large; 429 `too_many_open_requests`; 503 `booking_unavailable` / `booking_timeout`. |
| `getAvailability(store, hallId, from, to)` | The single availability function, for the public UI and future dashboards, admin calendar and reports. |
| `createCustomerBookingRequest(store, customer, input)` | Website request (pending, website source). |
| `createManualBooking(store, admin, input)` | Future admin walk-in / phone / WhatsApp entries (pending or confirmed). There is no route for it yet. |
| `changeBookingStatus(store, bookingId, to)` | Status changes with lock upkeep. There is no route for it yet. |
| `BookingStore` interface | Production: `firestoreBookingStore(adminFirestore())`. Tests: `MemoryBookingStore`. |

**Firestore indexes** (`firestore.indexes.json`, deployed with `firebase deploy --only firestore:indexes`):
1. `slotLocks (hallId ASC, date ASC)` for the availability range query (hall equality + date range).
2. `bookings (customerId ASC, status ASC)` for the open-request count (`customerId ==` + `status in`). Firestore can sometimes serve this without a composite index; it is declared so deployment never depends on a manual index.

## 10. Tests

Every command below was run in this phase unless marked otherwise.

| # | What | Command | Result |
|---|---|---|---|
| 1 | TypeScript | `npm run typecheck` (`tsc --noEmit`) | **PASS** (no errors) |
| 2 | ESLint | `npm run lint` | **PASS**: 0 errors, 1 pre-existing warning (`postcss.config.mjs`) |
| 3 | Booking unit + engine tests (in-memory transactional store) | `npm run test:booking` | **PASS 46/46** |
| 4 | Mutation check (slot check removed from the engine, then restored) | `node --test tests/booking/engine.test.ts` | Tests correctly **FAILED 7/27** with the check removed; 27/27 after restoring it |
| 5 | Same scenarios on the **real Firestore adapter + Firestore emulator** | `npm run test:booking:firestore` | **NOT EXECUTED — ENVIRONMENT BLOCKER** (Firestore emulator "Fatal error", Java loopback socket). The file loads and reaches the emulator connection (checked). |
| 6 | Firestore rules, including 13 new booking/slot-lock rules | `npm run test:rules` | **NOT EXECUTED — ENVIRONMENT BLOCKER** (same cause) |
| 7 | Storage rules | `firebase emulators:exec --only storage … --only=storage` | **PASS 3/3** |
| 8 | Booking API against the running app (Auth emulator; database unreachable on purpose) | harness `booking-api.mjs` | **PASS 23/23** |
| 9 | Booking UI in headless Chrome at 320 / 375 / 390 / 430 / 768 / 1024 / 1440 px (API responses supplied by the harness, real auth) | harness `booking-ui.mjs` | **PASS 31/31** (the first run found an overflow at 320 px, now fixed) |
| 10 | Auth E2E (Phase 2 regression) | harness `auth-e2e.mjs` | **PASS 25/25** (see note) |
| 11 | Password reset & session (Phase 2.1 regression) | harness `reset-e2e.mjs` | **25/26**: the one known same-second Firebase revocation limit (see the Phase 2.1 report) |
| 12 | Sign-out revocation | harness `logout-check.mjs` | **PASS 3/3** |
| 13 | Super Admin foundation | harness `admin-e2e.mjs` | **PASS 9/9** |
| 14 | Public site interactions (menu, inquiry modal, validation, gallery filter, tab order, console) | harness `interact.mjs` | **PASS**: no console errors |
| 15 | Home / gallery layout and hero video at 390 and 1440 px | harness `qa.mjs` | **PASS**: no horizontal overflow, no broken images, hero film playing |
| 16 | Production build, **no env vars** | `npx next build` | **PASS** (exit 0). `/book` shows the WhatsApp fallback, and both APIs return 503. |

**What each test covered:**
- **#3, availability:** empty date; Day held with Night free; Night booked with Day free; both booked = unavailable; past dates; invalid hall and range.
- **#3, capacity:** 1 and 1,000 accepted; 0, negative, fractional, text and 1,001 rejected; the engine refuses these on its own too.
- **#3, double booking:** sequential second customer refused; **A vs B at the same moment → exactly one**; **10 racing → exactly one**; Day + Night on the same date (also simultaneous) both succeed; different dates coexist; a staff walk-in blocks the website.
- **#3, duplicates and ownership:** the same request sent twice creates one booking; another customer reusing a request key cannot touch the first booking; identity, status and source always come from the server; the open-request limit.
- **#3, statuses:** a pending hold expires and the slot can be taken, with the old booking marked `expired`; an expired hold can still be confirmed if the slot is free; under_review holds with no expiry; confirmed blocks; cancel releases; reject releases; completed is final; invalid transitions are refused.
- **#3, other rules:** dates and time zone, validation, slot key, status table, pricing, and the price snapshot is preserved.
- **#8, booking API:** 401 without a session and with a forged session; 403 for cross-site requests and requests without an Origin; 403 for an unverified email; 400 for over-capacity, zero, negative, past, impossible and ambiguous dates, unknown slot or hall, and client-sent `status`, `customerId`, `total` or `advanceReceived`; malformed JSON 400; oversized body 413; **database failure → 503, never a fake success**; `GET /api/bookings` 405.
- **#9, booking UI:**
  - past and fully booked dates are disabled;
  - "Day booked" allows only Night;
  - held slots show "on hold";
  - signed-out users are sent to sign in and return to the same date and slot;
  - the name is prefilled;
  - validation messages are visible;
  - over-capacity is refused;
  - no invented price;
  - **slot taken meanwhile → the exact message "The selected slot is no longer available. Please choose another available slot."**;
  - a triple click sends **one** request;
  - success shows the reference and "not confirmed yet";
  - the browser sends no identity, status or price fields;
  - at every width: no horizontal overflow, dates stay inside the card, date cells ≥ 32×40 px (40×40 from 375 px), slot cards ≥ 66 px, inputs 48 px, 15 px text;
  - keyboard arrow navigation and a visible focus ring;
  - no console errors.

**Note on #10 (auth E2E):** the first Phase 3 run showed 2 failures in the Google popup checks. Investigation showed the app was fine:
- Google sign-in reached `/account`.
- A closed popup shows "Google sign-in was closed before it finished."
- The **test harness** had two timing races: it filled the popup form before it was visible, and it tried to close the popup while it was still `about:blank`.

Only those waits were fixed; no assertion was loosened. After the fix: 25/25.

**Console noise during auth tests:** only the Firebase SDK's "could not reach Cloud Firestore backend", because the Firestore emulator is not running (environment).

## 11. Files changed

**New**
- `src/lib/booking/catalog.ts`: halls, slots, event types, services, menu options
- `src/lib/booking/dates.ts`: business time zone and date helpers
- `src/lib/booking/status.ts`: statuses, the slot-holding rule, transitions
- `src/lib/booking/policy.ts`: hold hours, open-request limit, booking window, verified-email rule
- `src/lib/booking/model.ts`: booking and slot-lock types, slot key, reference
- `src/lib/booking/pricing.ts`: price configuration, `quote()`, snapshot
- `src/lib/booking/validation.ts`: server-side request validation
- `src/lib/booking/availability.ts`: the availability rule
- `src/lib/booking/store.ts`: the transactional store contract
- `src/lib/booking/engine.ts`: create / manual create / status change / availability
- `src/lib/booking/firestore-store.ts`: Firestore adapter (transactions + preconditions)
- `src/lib/booking/server.ts`: server wiring (`server-only`), timeout, safe logging
- `src/lib/auth/origin.ts`: shared same-origin check
- `src/app/api/availability/route.ts`, `src/app/api/bookings/route.ts`
- `src/app/(site)/book/page.tsx`
- `src/components/booking/AvailabilityCalendar.tsx`, `src/components/booking/BookingRequestFlow.tsx`
- `tests/booking/rules.test.ts`, `tests/booking/engine.test.ts`, `tests/booking/engine-scenarios.ts`, `tests/booking/memory-store.ts` (test-only store)
- `tests/firestore/engine.firestore.test.ts` (emulator run, refuses to run without `FIRESTORE_EMULATOR_HOST`)
- `SADIQ_PEARL_PHASE_2_1_REPORT.md`, `SADIQ_PEARL_PHASE_3_REPORT.md`

**Modified**
- `firestore.rules`: `bookings` and `slotLocks` closed to browsers
- `firestore.indexes.json`: 2 composite indexes
- `scripts/test-security-rules.mjs`: 13 booking/slot-lock rules tests (needs the Firestore emulator)
- `src/lib/firebase/admin.ts`: `adminFirestore()`; the Firestore emulator host is also recognised
- `src/app/api/auth/session/route.ts`: uses the shared `isSameOrigin`
- `src/lib/config.ts`: `eventTypeOptions` now derived from the single `EVENT_TYPES` list (same labels)
- `src/components/BookingModal.tsx`: link to `/book`
- `src/components/auth/AccountPanel.tsx`: "Check availability" button
- `src/app/sitemap.ts`: `/book`
- `package.json`: `test:booking`, `test:booking:firestore` scripts (no new dependencies)
- `tsconfig.json`: `allowImportingTsExtensions` (lets Node's built-in test runner load the TypeScript engine directly; `noEmit` is already set)
- `README.md`: booking section

## 12. Known limitations

- **Double-booking protection on real Firestore has not been executed.** The logic passes against a store that follows Firestore's transaction rules, and the adapter uses Firestore transactions plus `create`/`lastUpdateTime` preconditions. Before launch, run `npm run test:booking:firestore` and `npm run test:rules` on a machine where the Firestore emulator starts (Java 21+ and the Firebase CLI).
- **The UI was tested with API responses supplied by the test harness**, because Firestore could not run. The real API's auth, validation and failure paths were tested against the running app (#8).
- **Expired pending requests keep status `pending`** until another request takes the slot or staff act on them. Availability already treats them as free. A scheduled clean-up job belongs to a later phase.
- **There is no admin UI** to review, confirm or cancel requests yet (Phase 4+). Until then, requests can only be seen in the Firebase console. The venue should keep using WhatsApp as well.
- **The availability endpoint is public and not rate-limited.** It exposes no personal data, and each call is one indexed query. Rate limiting belongs with hosting configuration.
- **Same-day requests are accepted** (today is not in the past), because slot times are unknown. Once times are confirmed, a cut-off can be added.
- **Business rules waiting for confirmation are in one file each:**
  - `policy.ts`: hold of 48 h, 3 open requests, 730-day window;
  - `catalog.ts`: names, times, event types;
  - `pricing.ts`: prices.

## 13. Business information still required

| Item | Where it goes | Current value |
|---|---|---|
| Exact **Day** slot time | `SLOTS` in `catalog.ts` | `null`, shown as "Timing to be confirmed" |
| Exact **Night** slot time | `SLOTS` | `null` |
| Final **hall name** | `HALLS` | "Main Hall" (working name) |
| **Prices**: hall rent, per-guest rate, advance % | `PRICING_CONFIG` | not configured, so no prices are shown |
| Interpretation of the printed terms (below 300 guests: +Rs 300 per guest; 5% service charge) | `PRICING_CONFIG` | encoded, needs confirmation |
| **Services / add-ons** (decoration, lighting, sound…) and their prices | `SERVICES`, `PRICING_CONFIG.services` | none |
| Final **event types** | `EVENT_TYPES` | the list already on the public form (placeholder) |
| **Pending hold duration** | `bookingPolicy.pendingHoldHours` | 48 h (working value) |
| **Booking window** (how far ahead) | `bookingPolicy.bookingHorizonDays` | 730 days (working value) |
| **Cancellation / modification policy** | future phase | none |
| **Business time zone** | `BUSINESS_TIME_ZONE` | `Asia/Karachi`, derived from the confirmed address (Pakistan has one zone) |
| Whether same-day requests are allowed | future rule | allowed |

## 14. Blockers

1. **Firestore emulator cannot start on this machine**, so tests #5 and #6 were not executed.
2. **No real Firebase project** is connected yet, so online booking shows the WhatsApp fallback until `.env.local` / server credentials are configured and the rules and indexes are deployed (`firebase deploy --only firestore:rules,firestore:indexes`).
