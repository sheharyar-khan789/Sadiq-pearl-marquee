# Sadiq Pearl Marquee — Phase 6 Report (Business Configuration, Pricing, Services, Menus & Packages)

| | |
|---|---|
| Date | 2026-10-01 |
| Scope | Super Admin business configuration (`/admin/settings`) and making the existing booking engine, public booking page, staff bookings, change approvals and customer portal consume it. |
| Not built (future phases) | Payment gateways / JazzCash / Easypaisa / Stripe / card processing, payment recording UI, receipts, quotations, vendors, notifications, WhatsApp/SMS/email automation, analytics, accounting |
| Data | **No business values were invented.** Prices, slot times, services and packages start empty ("not configured"). The only pre-filled content is what the project already had. All test entities were named "E2E …" and existed only in the local test store. |

> **Firestore emulator — still an environment blocker** (unchanged since Phase 3; confirmed again). These are **NOT EXECUTED — ENVIRONMENT BLOCKER**:
> - `npm run test:rules`, now including 3 `businessConfig` tests;
> - `npm run test:booking:firestore`.
>
> **No real-Firestore or Firestore-emulator result is claimed.**

---

## 1. What was implemented

- **One configuration source:** `src/lib/config/business-config.ts` holds the model, the defaults and the lookups. It is stored as `businessConfig/main`.
- **Settings UI (`/admin/settings`):** sections for Venue, Hall, Slots, Booking rules, Event types, Services, Menus (with items), Packages, Pricing & advance, Policies and Change history.
  - Loading, empty, error, retry and success states.
  - Every consequential toggle (deactivate/activate) goes through a confirmation dialog.
- **Settings API (`POST /api/admin/settings`):**
  - checks the Super Admin on the server;
  - rejects unknown fields and validates every field strictly;
  - rejects stale edits;
  - writes the change and its audit record in **one transaction**.
- **Pricing engine extended, not replaced:** `quote()` in `src/lib/booking/pricing.ts` is still the only pricing function. It now calculates hall rent, per-guest rate, package, menu, services, small-event surcharge, discount, service charge and advance, all from the configuration.
- **Consumers wired to the configuration:**
  - the booking engine (create, capacity, minimum guests, hold hours, open-request limit);
  - the availability engine (active slots, horizon, same-day rule);
  - request validation;
  - change requests (modification policy);
  - admin approvals (re-validation and re-pricing);
  - staff bookings;
  - `/book` (hall, slots with times, event types, menus, packages, services, live price estimate, published policies);
  - the customer portal (package snapshot, discount line, policies, only allowed change fields);
  - the admin pages (filters, calendar slot labels, hold hours, package display).
- **Behaviour is unchanged until the admin saves anything.** Every Phase 3–5 test passes unchanged in meaning (see §18).

## 2. Business configuration (Venue)

- **Read-only, verified values** come from `src/lib/config.ts`: business name, address, phones.
- **Time zone:** `Asia/Karachi`, shown fixed. It drives "today" for every rule and is deliberately not editable, because changing it would silently shift booking dates.
- The venue name and contact details stay in the website configuration, so they can't be overwritten by mistake.

## 3. Hall

- One hall with the stable ID `main-hall` (never renamed). The admin edits the **display name** and the **capacity** (1–100,000; validated on the server).
- Default capacity is **1,000** (confirmed); the display name "Main Hall" still needs confirmation.
- The model is a list of halls, but **no extra halls were created** and there is no "add hall" UI.
- Capacity is enforced by **validation and again inside the engine** (API test: 600 guests refused when capacity is 500).

## 4. Day / Night slots

- Stable IDs `day` / `night` (Phase 3). The admin edits the display name, **start/end time** (HH:mm), active state and order.
- Times are **null = "Not configured"** by default. The public page shows "Timing to be confirmed" until they are set.
- **Validation:**
  - both times must be set, or neither;
  - valid 24-hour format;
  - start ≠ end (a Night slot may cross midnight);
  - at least one slot must stay active.
- Inactive slots are not offered or bookable. Existing locks and bookings are untouched, and the other slot keeps working (tested).

## 5. Booking rules

| Rule | Default (Phase 3 behaviour) | Editable range |
|---|---|---|
| Pending hold | **48 hours** | 1–720 |
| Booking horizon | **730 days** | 1–1,825 |
| Same-day requests | **allowed** | yes / no |
| Minimum guests | none | 1 – capacity |
| Maximum guests | = hall capacity | Hall section |
| Open requests per customer | 3 | 1–20 |
| Customers may request changes to date / slot / guests / services / menu | all yes | each yes / no |

- **No default was changed.**
- The modification policy only controls which changes a customer can **request**. Approval still goes through the Phase 5 atomic transaction.
- "Enabled slots / event types" are their `active` flags.
- Verified email for booking stays a fixed **security** rule, not a business setting.

## 6. Event types

- The existing list (Wedding (Shadi), Nikkah, Mehndi, Barat, Walima, Engagement, Family Gathering, Other) is **preserved** with its IDs.
- The admin can add, edit and activate/deactivate event types, with a name, description and order. **No hard delete.** At least one must stay active.
- Bookings keep their stored `eventTypeLabel`.

## 7. Services

- **Categories (fixed):** decoration, stage, lighting, flooring, tables & chairs, photography, DJ/sound, AC, generator, bridal room, other.
- **No services are pre-created** ("No services configured.").
- Each service has a stable ID, name, description, category, active flag, order, **pricing mode** (`fixed` / `per_guest` / not configured) and a price.
- A price needs a mode. A missing price makes the booking's pricing **pending**, never a guess.

## 8. Menus

- **Pre-filled only with the 9 menus transcribed from the venue's printed menu card:** Wedding Menus 1–7 and Mehndi Menus 1–2, with their printed dishes as items.
  - IDs are unchanged (`w1`–`w7`, `m1`, `m2`), so existing menu preferences still resolve.
  - They carry **no prices** (the card has none).
- Each menu has a name, description, active flag, order, pricing mode, price and **items** (name, category, description, active, order). Items can be added, edited, removed or deactivated. **No dishes were invented.**

## 9. Packages

- **"No packages configured."** None were invented.
- A package **references** active service IDs and an optional menu ID (validated, never copied), and has a fixed or per-guest price.
- On `/book`, choosing a package locks its menu and marks its services "Included in the package". Its services and menu are **not charged twice**.

## 10. Pricing engine

The calculation is:

1. hall rent;
2. plus per-guest rate × guests;
3. plus the package (fixed, or per guest);
4. plus the menu (unless it is the package's own menu);
5. plus each service not already in the package (fixed, or per guest);
6. plus the small-event surcharge (only if configured and the guest count is below the threshold);
7. = **subtotal**;
8. minus the **discount** (only if configured; shown with its label);
9. plus the **service charge** (only if configured);
10. = **total**;
11. **advance** (percent or fixed, only if configured);
12. **remaining** = total − advance.

- **Rules:**
  - every needed price must be configured, otherwise **"Pricing pending"**, with the missing items listed internally;
  - `0` is a real price ("no charge");
  - no tax or charge is added unless it is configured;
  - amounts are whole PKR.
- **The same engine is used** by `/book` (live estimate), staff bookings (live estimate), the server when saving any booking, and admin modification approvals (re-price with the *current* configuration; pending if prices are missing).
- **From the printed terms card:** the small-event surcharge (below 300 guests: Rs 300 per guest) and the 5% service charge are pre-filled, as in Phase 3. They apply only once base prices exist, and the UI marks both "confirm or remove".

## 11. Advance configuration

- Advance can be not configured (default), a percentage of the total, or a fixed amount (capped at the total).
- The price breakdown shows **total, advance required and remaining** only when real prices exist.
- **No payment is processed.** The existing `payment` fields (`advanceRequired`, `advanceReceived`, `balanceDue`) are preserved and filled only from real pricing. `advanceReceived` stays 0 (no payments are recorded yet) and is kept when a booking is re-priced.

## 12. Policies

- Cancellation, refund and modification policy text, an effective date and **published (active)**. The defaults are empty and unpublished.
- When published, the policies are shown on `/book` (review step) and on the customer's booking page. At least one text is required to publish.
- **No refund is calculated.** The cancellation behaviour of Phase 5 is unchanged.

## 13. Admin routes

| Route | Purpose |
|---|---|
| `/admin/settings?section=venue|hall|slots|rules|event-types|services|menus|packages|pricing|policies|history` | Configuration UI |
| `POST /api/admin/settings` `{section, op?, id?, data, expectedVersion?}` | The single mutation endpoint (Super Admin only) |

## 14. Data model

`businessConfig/main` is **one versioned document**:

```
schemaVersion, version, updatedAt, updatedBy
halls[]      {id, name, capacity, active, version}
slots[]      {id: day|night, label, startTime, endTime, active, sortOrder, version}
rules        {pendingHoldHours, bookingHorizonDays, sameDayBookingAllowed, minGuests,
              maxOpenRequestsPerCustomer, modifications{date,slot,guestCount,services,menu}, version}
eventTypes[] {id, name, description, active, sortOrder, version}
services[]   {id, name, description, category, pricingMode, price, active, sortOrder, version}
menus[]      {id, name, description, pricingMode, price, active, sortOrder, version, items[]}
packages[]   {id, name, description, pricingMode, price, serviceIds[], menuId, active, sortOrder, version}
pricing      {currency, hallRent{hallId}, perGuestRate, smallEventSurcharge, serviceChargePercent,
              discount, advance, version}
policies     {cancellationPolicy, refundPolicy, modificationPolicy, effectiveDate, active, version}
```

- **Why one document, not one collection per entity:**
  - one read per request;
  - atomic, consistent snapshots, with `configVersion` recorded in every price snapshot;
  - simple transactions with per-item versions;
  - well within Firestore's size limit for a one-hall venue.

  It fits the project's existing single-business architecture; no tenant hierarchy was invented.
- **Bookings (additive changes only):** an optional `package` snapshot `{id, name, serviceIds}`, and the price snapshot gained `discount` / `discountLabel`. Older bookings stay valid.
- **Audit:** `adminAudit` records gained optional `entityType: "config"` and `entityId`.
- **Reading and caching:**
  - admin pages, booking creation and approvals always read the configuration **fresh**;
  - public pages use an active-only copy cached for 30 s per server process (`globalThis`, shared across route bundles), cleared on every save;
  - if the configuration can't be read, booking **fails closed** (503) instead of guessing.

## 15. Historical snapshot protection

- Every booking stores: the hall name, slot label, event-type label, service names, menu title, package name, and the full price snapshot with `configVersion`.
- Configuration edits **never touch booking documents**. They only affect future calculations.
- Customer, admin and portal pages render booking snapshots, not live configuration.
- Entities are **never hard-deleted** (there is no delete operation; deactivation only), so older references keep resolving.
- Tested:
  - price changed after booking → old booking unchanged, new booking uses the new price (unit + browser);
  - deactivated service still shown on an existing booking, refused for new ones (unit + browser + API).

## 16. Security

- **Only the Super Admin can change configuration:**
  - the page and the data loader verify the admin, as in Phase 5;
  - the API checks same-origin, session and the server-set claim + verified email.
  - Tested: no session 401, customer 403, unverified admin 403, cross-site 403; pages refuse with 307/404.
- **Server-side validation:** allow-listed fields only. Rejected:
  - negative, fractional or oversized prices, and a price without a mode;
  - percentages outside 0–100;
  - capacity ≤ 0, invalid or half-set times;
  - duplicate IDs or names, empty names;
  - unknown sections or operations, malformed data;
  - packages referencing unknown or inactive services or menus;
  - deactivating the last slot or event type.
- **Inactive items are refused for new bookings** in validation **and** in the engine. Historical bookings stay valid.
- **Firestore rules:** `businessConfig/*` is `allow read, write: if false` for browsers (no direct price tampering). No collection was opened.
- **Stale edits / concurrency:** every section and item has a version. The API rejects an edit made on an older version (409 "Someone saved this item after you opened it…"). The transaction uses a `lastUpdateTime` precondition, so two simultaneous saves can't both win (tested: one saves, one is told it is stale).

## 17. Audit trail

- Every configuration change writes an `adminAudit` record **in the same transaction**. It holds:
  - the action (`config_created`, `config_updated`, `config_activated`, `config_deactivated`);
  - `entityType: "config"`, `entityId` (e.g. `services/e2e-stage-decoration`, `pricing`, `rules`);
  - the admin's uid and email;
  - before/after values and a timestamp.
- **No passwords, keys or credentials** exist in configuration, so none are audited (tested).
- `/admin/settings?section=history` lists the latest 30 changes.

## 18. Files changed

**New**
- `src/lib/config/business-config.ts`: model, defaults, lookups, public view
- `src/lib/config/config-admin.ts`: validation, apply, transactional write + audit
- `src/lib/config/config-server.ts`: fresh and cached loaders
- `src/app/(admin)/admin/settings/page.tsx`, `src/app/api/admin/settings/route.ts`
- `src/components/admin/settings/SettingsForms.tsx` (hall, slots, rules, pricing, policies), `EntityManager.tsx` (event types, services, menus, packages)
- `src/components/booking/PriceBreakdown.tsx`: shared price display
- `tests/booking/config.test.ts`, `tests/booking/test-config.ts`
- `SADIQ_PEARL_PHASE_6_REPORT.md`

**Modified**
- `src/lib/booking/`:
  - `pricing.ts`: quote from configuration; discount
  - `validation.ts`: configuration-aware; package field; date/guest rules
  - `engine.ts`: `options.config`; package snapshot; configured rules
  - `availability.ts`: active slots, same-day rule
  - `customer.ts`: modification policy
  - `admin.ts`: configuration in manual booking and approvals
  - `catalog.ts`: now re-exports the configuration
  - `model.ts`: package snapshot
  - `portal.ts`, `portal-server.ts`, `admin-server.ts`, `admin-view.ts`, `audit-model.ts`
  - `store.ts`, `firestore-store.ts`, `testing/memory-store.ts`: configuration document, configuration audit
- **Removed:** `src/lib/booking/policy.ts`. Its values moved into the configuration rules; the verified-email rule is now a constant in `/api/bookings`.
- **API routes:** `/api/bookings`, `/api/availability`, `/api/account/bookings/[id]/requests`, `/api/admin/bookings`, `/api/admin/requests/[id]/decision`
- **Pages and components:**
  - `/book` page + `BookingRequestFlow`
  - portal booking page + `ChangeRequests`, `BookingSections`
  - admin pages (bookings list, new booking + `ManualBookingForm`, booking detail, calendar), `AdminNav`, `AdminUi` (table only from `lg`, inside its own scroll box)
- `src/lib/config.ts`: the inquiry form's event types come from the configuration defaults
- `firestore.rules`, `scripts/test-security-rules.mjs` (3 new tests)
- Tests updated to the configuration API with **the same expectations**: `rules.test.ts`, `engine-scenarios.ts`, `portal.test.ts`, `admin.test.ts`, `tests/firestore/admin.firestore.test.ts`
- `README.md`

## 19. Tests

**Environment key:**
- **In-memory:** Node's test runner + the in-memory transactional store (Firestore-like transaction rules; not Firestore).
- **Browser:** headless Chrome + production build + **Auth emulator** (real sessions and claims) + the local in-memory store, or the real Firestore adapter with Firestore unreachable.
- **Mocked API:** `booking-ui.mjs` supplies API responses.
- **Real Firestore / Firestore emulator:** none executed.

| # | Test | Command / harness | Environment | Result |
|---|---|---|---|---|
| 1 | TypeScript | `npm run typecheck` | local | **PASS** (exit 0) |
| 2 | ESLint | `npm run lint` | local | **PASS**: 0 errors, 1 pre-existing warning |
| 3 | Unit/engine: Phase 3–5 suites (93) + **20 new configuration tests** | `npm run test:booking` | in-memory | **PASS 113/113** |
| 4 | Mutation checks: stale-version check removed / active-service validation removed | `node --test tests/booking/config.test.ts` | in-memory | Each made **2 tests FAIL** as expected; **113/113** after restoring |
| 5 | **Phase 6 configuration E2E**: security, settings UI, `/book` + staff booking + portal consuming configuration, snapshots, deactivation, capacity, 15 pages × 7 widths | harness `settings-e2e.mjs` | Browser + Auth emulator + in-memory | **PASS 44/44** (final run; see note) |
| 6 | Admin panel (Phase 5) | harness `admin-panel-e2e.mjs` | Browser + Auth emulator + in-memory | **PASS 68/68** |
| 7 | Customer portal (Phase 4) | harness `portal-e2e.mjs` | Browser + Auth emulator + in-memory | **PASS 89/89** |
| 8 | Booking UI (Phase 3) | harness `booking-ui.mjs` | Browser + **mocked API** | **PASS 31/31** (see note) |
| 9a | Booking API, database unreachable | `MODE=down node booking-api.mjs` | Auth emulator + real adapter, Firestore unreachable | **PASS 23/23** |
| 9b | Booking API, working store (validation codes) | `MODE=up node booking-api.mjs` | Auth emulator + in-memory | **PASS 21/21** |
| 10 | Admin failure states / portal failure states | `admin-failure.mjs` / `portal-failure.mjs` | real adapter, Firestore unreachable | **PASS 6/6** / **8/8** |
| 11 | Auth E2E | `auth-e2e.mjs` | Browser + Auth emulator | **PASS 25/25** |
| 12 | Password reset / session | `reset-e2e.mjs` | Browser + Auth emulator | **PASS 26/26** |
| 13 | Sign-out revocation | `logout-check.mjs` | Auth emulator | **PASS 3/3** |
| 14 | Super Admin foundation | `admin-e2e.mjs` | Auth emulator | **PASS 9/9** |
| 15 | Public site (interactions, home/gallery/book layout, hero video) | `interact.mjs`, `qa.mjs` | Browser | **PASS**: no console errors, no overflow, no broken images, hero film playing |
| 16 | Storage rules | `firebase emulators:exec --only storage … --only=storage` | Storage + Auth emulator | **PASS 3/3** |
| 17 | Firestore rules (including 3 new `businessConfig` tests) | `npm run test:rules` | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 18 | Engine/admin concurrency on the real Firestore adapter | `npm run test:booking:firestore` | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| 19 | Production build, no env vars | `npx next build` | local | **PASS** (exit 0; no database access during the build). Unconfigured server: `/admin/settings` → 307, settings API → 401, `/book` shows the WhatsApp fallback |

**What #5 proves:**
- **Settings pages:** 307/404 for signed-out users, customers and unverified admins.
- **Settings API:** 401/403/403/403 (no session, customer, unverified admin, cross-site). Unknown field 400; invalid values 400 with field errors; capacity 0 rejected; no delete operation; **stale edit 409**.
- **Empty states and pre-fills:** services and packages are empty; menus come only from the printed card, with "Pricing pending"; pricing starts empty.
- **Changes made through the UI:** slot times, a service, pricing, policies.
- **Audit:** the change history shows each change with the admin's email.
- **Effect on `/book`:**
  - shows the configured Day time, and "Timing to be confirmed" for Night;
  - offers the configured service and menus;
  - the review shows the **real price**: 100,000 + 300×500 + 40,000 = **Rs 290,000**, advance **Rs 87,000**, remaining **Rs 203,000**;
  - the request is saved through the real API.
- **After the admin changed the per-guest rate and deactivated the service:**
  - the customer's old booking still shows **Rs 290,000 and the service**;
  - `/book` no longer offers the service, and the API refuses it.
- **Capacity:** changed to 500; the server rejects 600 guests and `/book` shows "up to 500".
- **Staff booking form:** shows the same engine's price with the new rate (**Rs 280,000**, advance **Rs 84,000**) and no longer offers the inactive service.
- **Overflow:** no horizontal overflow on `/`, `/gallery`, `/book`, `/login`, `/account`, `/account/bookings`, `/admin`, `/admin/bookings`, `/admin/bookings/new`, `/admin/calendar`, `/admin/customers`, `/admin/settings` (and the pricing, services and menus sections) at **320 / 375 / 390 / 430 / 768 / 1024 / 1440 px**.
- No console errors.

**Notes (all transparent):**
- **Bugs found and fixed in Phase 6 by #5:**
  1. After saving, the settings forms re-mounted and **the success message vanished**. They no longer re-mount; stale protection still uses the current version from the server.
  2. The public configuration cache was per Next.js bundle, so **a save didn't clear the copy used by `/book`**. It is now per process (`globalThis`).
  3. The admin booking table **overflowed at 768 px**. It is now cards below `lg`, and a contained table above.
- **Harness waits:** two harness checks were made to wait for the refreshed list after a save instead of reading it immediately. The same values are asserted.
- **#8 (booking UI):** one check looked for the old sentence "Confirmed by our team". Since Phase 6 the same state is shown by the shared "Pricing pending" breakdown. The check now looks for that text; **"no Rs amount shown" is still asserted.**
- **#9 (booking API):** since Phase 6, validation uses the stored configuration, so with the database unreachable those requests now **fail closed (503)** instead of returning 400. The harness gained `MODE`:
  - `down` asserts the 503 fail-closed behaviour and the database-failure checks;
  - `up` asserts all 12 original 400 validation codes against a working store.

  No assertion was removed.

## 20. Known limitations

- **Firestore blocker:** rules and transactions are not verified on real Firestore here (§19 #17, #18).
- **Venue details** (name, address, phones) stay code-managed. They are verified and shown read-only in Settings; editing them would need a separate, careful change to the public site's metadata.
- **One hall:** there is no add-hall UI (by requirement: no fake halls).
- **Config propagation:** public pages may show configuration up to 30 s old on *other* server instances (the same instance refreshes immediately). Booking creation always uses fresh configuration.
- **Inquiry form:** the WhatsApp inquiry form (Phase 1) still lists the default event types; it doesn't read the stored configuration.
- **Menu items** are edited inside the menu (no separate item library shared across menus).
- **No payments:** payment recording, receipts and refunds are not built. `advanceReceived` stays 0 until a payment phase exists.
- **Printed-card rules:** the small-event surcharge and the 5% service charge come from the printed card; their interpretation is unconfirmed (they only apply once base prices are entered).

## 21. Business values still to be entered (in `/admin/settings`)

1. **Hall display name** (Hall).
2. **Day slot start/end time** and **Night slot start/end time** (Slots).
3. **Hall rent** and **per-guest rate** (Pricing). Enter 0 only if genuinely none.
4. **Advance**: percentage or fixed amount (Pricing).
5. **Confirm or remove** the printed-card terms: the small-event surcharge (below 300 guests, Rs 300 per guest) and the 5% service charge (Pricing).
6. **Services and prices**, within the established categories (Services).
7. **Menu prices** (per guest or fixed), plus any corrections to the printed dishes (Menus).
8. **Packages**: contents and prices (Packages).
9. **Final event-type list** (Event types).
10. **Cancellation, refund and modification policies**, and when to publish them (Policies).
11. **Same-day booking policy**, **final pending-hold duration** and **booking horizon** (Booking rules). The defaults are same-day allowed, 48 h and 730 days.
12. **Which changes customers may request** (Booking rules → modification policy).
