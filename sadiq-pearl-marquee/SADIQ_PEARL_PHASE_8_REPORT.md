# Sadiq Pearl Marquee — Phase 8 Report
## Event Operations & Operational Calendar (+ Phase 7 carry-forward)

Phase 8 is implemented and verified with in-memory, browser and API tests. **Real-Firestore verification
is still NOT EXECUTED — ENVIRONMENT BLOCKER** (see "Firestore Verification"). Nothing in this report
claims a Firestore result.

---

## What Was Implemented

- **Phase 7 carry-forward:**
  - Firestore tests retried; still blocked, with the exact error recorded.
  - Refund / financial-adjustment state for change requests.
  - Historical-immutability scenario for every pricing input.
  - Urdu-font check.
  - Public WhatsApp inquiry form now uses the configured event types.
  - Configuration cache reviewed.
- **Event operations:**
  - one operational record per booking (`eventOperations/{bookingId}`);
  - operational status;
  - preparation checklist;
  - internal notes;
  - completed-event record.
- **Vendors:** CRUD (create, edit, deactivate, reactivate; never delete) and assignments with clash detection.
- **Admin screens:**
  - `/admin/events` (upcoming events, filters and search);
  - `/admin/events/{id}` (event sheet);
  - `/admin/vendors` and `/admin/vendors/{id}`;
  - the existing `/admin/calendar` extended with **Week** and **Day** views.
- **Security:** rules for the 3 new collections plus 9 new rules tests; every mutation is audited in the existing `adminAudit` trail.

## Phase 7 Carry-Forward

| # | Item | Result |
|---|---|---|
| 1 | `npm run test:rules`, `npm run test:booking:firestore` | Retried with JDK 25. **NOT EXECUTED — ENVIRONMENT BLOCKER.** The Firestore emulator exits at start: `io.netty.channel.ChannelException: failed to open a new selector` (`firestore-debug.log`). A minimal standalone Java program fails the same way: `java.io.IOException: Unable to establish loopback connection` at `sun.nio.ch.PipeImpl`. Java's internal loopback pipe is blocked inside this agent's sandbox. The project is not the cause. |
| 2 | Real-Firestore financial verification (17 steps) | Written as `tests/firestore/immutability.firestore.test.ts`, plus the Phase 7 `finance.firestore.test.ts`. **NOT EXECUTED** (blocker). The same 17 steps run **in memory** in `tests/booking/immutability.test.ts` and pass. That is an in-memory result, **not** a Firestore result. |
| 3 | Modification that would need a refund | Protection kept (`total_below_paid`). See "Refund / financial adjustment" below. |
| 4 | Historical immutability | All nine pricing inputs were changed. The old booking quote, quotation, payments and receipts are unchanged, and a new booking uses the new configuration. Verified in memory and through the browser and API. |
| 5 | Urdu PDF font | **Not fixed; no usable font exists in the project.** The only TTF is Next.js's Latin-only `Geist-Regular.ttf`, and `@pdf-lib/fontkit` (needed to embed a custom font) is not installed. No font was downloaded. Requirement: a licence-cleared Unicode Urdu font file (e.g. a Naskh/Nastaliq TTF the business is allowed to embed) placed in the repo, plus `@pdf-lib/fontkit`. Then register it in `documents-pdf.ts`, where `pdfSafe()` is the single replacement point. |
| 6 | Public inquiry event types | Fixed (details below). |
| 7 | Public configuration cache | Reviewed and documented (details below). |
| 8 | Business information | Nothing invented. No vendors, prices, timings, menus, packages or policies were added. |

**Refund / financial adjustment.**
- **Admin booking page:** the page projects what approving an open change would cost, using the same rules as approval and writing nothing (`projectModificationPrice`). If the new total would fall below the amount already paid:
  - an explicit **"⚠ Refund / financial adjustment required"** box is shown with the new total, the paid amount and the difference;
  - **Approve** is disabled.
- **The API:** refuses with `409 total_below_paid` and the message "Refund / financial adjustment required: … Nothing was changed."
- **Cancellation requests on paid bookings:** show a note that payments and receipts stay unchanged and that any refund must be handled outside the system.
- **Nothing is reduced or fabricated:** payments, receipts and refunds are untouched. A refund workflow needs a configured refund policy.

**Inquiry event types.**
- `src/lib/config.ts` no longer exports the hard-coded `eventTypeOptions`.
- The WhatsApp inquiry form (`BookingForm`) loads the **active** event types from `GET /api/public/event-types`. That endpoint reads the stored configuration through the public cache; inactive types are excluded.
- **States:**
  - loading: "Loading event types…", select disabled;
  - error or empty list: a free-text event field with an honest message.
- The WhatsApp destination and the message format are unchanged.
- Public pages stay static (the fetch happens client-side).

**Configuration cache, reviewed.**
- **Always fresh:** every write and every admin path (booking creation, change approval, staff bookings, pricing, payments, quotations, settings, admin pages) uses `loadConfigFresh()`.
- **Cached:** only public **display** paths (`/book`, `/api/availability`, `/api/public/event-types`) use the 30-second public cache.
  - The cache is cleared immediately in the process that saves.
  - Another server instance can show the previous configuration for at most 30 seconds.
- **Cannot become dangerously stale:** a booking submitted from a stale page is re-validated against the fresh configuration and rejected or priced correctly.
- Caching was not disabled.

## Operational Calendar

- **Same calendar extended**, not duplicated. A Month / Week / Day switch is added.
- **Month view:** availability grid unchanged. The date panel adds the operational status and an "Open event sheet" link.
- **Week view (Mon–Sun) and Day view:** per date and slot they show the event (customer, type, guests, hall, reference), booking status, operational status, checklist progress, remaining balance and a link to the event sheet. Pending or under-review requests are shown as requests.
- **Data source:** availability from the booking engine (same as public), bookings by date range, operational status in one batched read. No event copies are stored.

## Event Operations

- **One record per booking:** `eventOperations/{bookingId}` uses the **booking ID as its document ID**, so it can never duplicate.
  - It is created inside the transaction of the first operational change. `create()` fails if another admin created it at the same moment, so the transaction retries; it never duplicates.
- **Scope:** only **confirmed** or **completed** bookings are operational.
- **Mutations:** every mutation reads the booking but never writes it.

## Event Sheet (`/admin/events/{bookingId}`)

- **Event:** reference, date, slot, hall, event type, guests.
- **Customer:** name, phone (tap to call), email.
- **Payment summary (read-only, Phase 7):** total, paid, remaining, financial status.
- **Selections:** package, menu, services, customer notes.
- **Operations:** operational status, checklist, vendors (contact details are admin-only), internal notes, completed-event record and operations history.
- **Cancelled or rejected bookings:** the sheet is read-only with a banner.

## Checklist

- **Generated only from what the booking includes:**
  - venue preparation (hall, seating for N guests);
  - one item per selected service;
  - the package and the services it includes;
  - the selected menu.
- **Nothing for unselected services:** unit test plus an API 404 for an unselected service item.
- **Each item has:**
  - status: Pending / In progress / Done;
  - an optional note;
  - "completed by" and "completed at", cleared when reopened;
  - who last updated it.
- **Staff can add custom items.**
- **After an approved booking change**, "Update checklist" adds new selections and marks removed ones as "no longer on the booking". Nothing is deleted.

## Vendors

- **Records:** `vendors/{vd_…}` with name, category, phone, optional WhatsApp, optional email, notes and active flag.
- **Categories:** decorator, photographer, DJ/sound, lighting, florist, furniture, catering, generator, AC, other.
- **Create is idempotent**, keyed by the form submission.
- **Validated server-side:** unknown fields are refused.
- **Never deleted:** a vendor is deactivated instead.
- **None are pre-filled.**

## Vendor Assignments

- **Records:** `vendorAssignments/{va_…}` hold booking, vendor, category, status (Assigned / Confirmed by vendor / Unassigned), notes, assigned by/at, and the vendor name at assignment time.
- **Unassigning** keeps the record.
- **Clash detection:**
  - a vendor already on another **still-active** event with the same **date and slot** is refused (`409 vendor_conflict`, naming the other booking);
  - the vendor's assignments are read inside the transaction, so two admins can't create a clash at the same moment (tested);
  - a cancelled booking frees its vendors.
- **Clash warnings on the event sheet** are recomputed from current booking data, so a booking moved by an approved change shows any new clash.
- **When clashes can happen:** with the venue's single hall, two events can't share a slot, so clashes only arise if more halls are configured. The tests use a fixture second hall.
- **No notifications** are sent (Phase 9).

## Operational Status

- **Separate from the booking status:** Not started → Preparing → Ready → In progress → Completed.
- **One step at a time,** forward or back.
- **Date rule:** "In progress" and "Completed" only from the event date.
- **On completion:** the record stores a snapshot (date, slot, hall, guests, customer, total, paid, remaining) for history.
- **The booking status** remains controlled only by the booking engine.

## Financial Integration

- **Read-only:** the event sheet and lists show `financialSummary(booking)`: the stored price and the recorded payments.
- **Nothing is written to finance data:** no operational function writes bookings, slot locks, payments, quotations or receipts.
- **Proven by test:** a test snapshots booking, payments, quotations and the slot lock, runs every operational action, and checks they are identical afterwards.

## Booking Integration

- **Live source:** date, slot, hall, customer, guests and booking status are always read live from the booking.
- **Approved date/slot change:** the event follows automatically (same record ID), with no duplicate.
- **Cancelled, rejected, pending or expired bookings:**
  - never appear in active event lists or calendar event entries;
  - their operations are read-only history.
- **Completing the booking** (booking engine) leaves the operations record intact.

## Security

- **Admin-only access:** every page and loader verifies the Super Admin (`run()`); every API uses `adminMutation`, which checks:
  - same-origin;
  - a verified session;
  - the `super_admin` claim;
  - a verified email.
- **Results:** customers get 404 on pages and 403 on APIs; signed-out users get 401 or a sign-in redirect.
- **Firestore rules:** `eventOperations`, `vendors` and `vendorAssignments` are `allow read, write: if false`.
- **Customer portal:** shows no notes, checklist, operational status, vendors or vendor phone numbers (tested on the page and in the view model).
- **No new staff role** was added.

## Audit Trail

The existing `adminAudit` trail records:

| Area | Actions |
|---|---|
| Vendors | `vendor_created`, `vendor_updated`, `vendor_deactivated`, `vendor_activated` |
| Assignments | `vendor_assigned`, `vendor_assignment_confirmed`, `vendor_unassigned` |
| Status | `ops_status_changed` |
| Checklist | `checklist_item_updated` (reason "completed" or "reopened"), `checklist_item_added`, `checklist_synced` |
| Notes | `ops_note_added`, `ops_note_updated` |

Note text is **not** copied into the audit; only its ID and size are.

## Data Model

| Owner | Data |
|---|---|
| Booking (Phases 3–5) | date, slot, hall, customer, guests, booking status |
| Phase 7 | price snapshot, payments, quotations, receipts |
| Phase 8 | `eventOperations/{bookingId}`: `status`, `checklist[]`, `notes[]`, `completedSnapshot`, timestamps |
|  | `vendors/{vd_<20hex>}` |
|  | `vendorAssignments/{va_<24hex>}` |

- **Queries:** all new queries are single-field equality (`vendorId`, `bookingId`, `active`, or `entityType` + `entityId`) or document batches, served by automatic indexes. `firestore.indexes.json` is unchanged.
- **Reads are bounded:** event lists use the existing date-range query, limited to 500 bookings with a capped 92-day custom range. Vendors are capped at 500. No collection is loaded whole.

## Routes / APIs

**Pages:**
- `/admin/events`
- `/admin/events/[bookingId]`
- `/admin/vendors`
- `/admin/vendors/[vendorId]`
- `/admin/calendar?view=week|day&date=…` (Month unchanged)

**APIs (all Super Admin):**

| Method and path | Body |
|---|---|
| `POST /api/admin/events/{bookingId}/status` | `{to}` |
| `POST /api/admin/events/{bookingId}/checklist` | `{action:"update"\|"add"\|"sync", …}` |
| `POST /api/admin/events/{bookingId}/notes` | `{action:"add"\|"edit", …}` |
| `POST /api/admin/events/{bookingId}/vendors` | `{vendorId, category, notes?}` |
| `POST /api/admin/vendor-assignments/{assignmentId}` | `{status:"confirmed"\|"cancelled"}` |
| `POST /api/admin/vendors` | create |
| `POST /api/admin/vendors/{vendorId}` | `{action:"update"\|"activate"\|"deactivate"}` |

**Public:** `GET /api/public/event-types` (active event types only).

## Files Changed

**New**
- `src/lib/booking/operations-model.ts`
- `src/lib/booking/operations.ts`
- `src/lib/booking/operations-view.ts`
- `src/lib/booking/operations-server.ts`
- `src/lib/booking/operations-api.ts`
- `src/components/admin/EventOps.tsx`
- `src/components/admin/OpsUi.tsx`
- `src/components/admin/VendorForm.tsx`
- `src/components/usePublicEventTypes.ts`
- `src/app/(admin)/admin/events/page.tsx`
- `src/app/(admin)/admin/events/[bookingId]/page.tsx`
- `src/app/(admin)/admin/vendors/page.tsx`
- `src/app/(admin)/admin/vendors/[vendorId]/page.tsx`
- `src/app/(admin)/admin/calendar/CalendarRangeView.tsx`
- `src/app/(admin)/admin/calendar/ViewSwitch.tsx`
- `src/app/api/admin/events/[bookingId]/status/route.ts`
- `src/app/api/admin/events/[bookingId]/checklist/route.ts`
- `src/app/api/admin/events/[bookingId]/notes/route.ts`
- `src/app/api/admin/events/[bookingId]/vendors/route.ts`
- `src/app/api/admin/vendor-assignments/[assignmentId]/route.ts`
- `src/app/api/admin/vendors/route.ts`
- `src/app/api/admin/vendors/[vendorId]/route.ts`
- `src/app/api/public/event-types/route.ts`
- `tests/booking/operations.test.ts`
- `tests/booking/operations-scenario.ts`
- `tests/booking/immutability.test.ts`
- `tests/booking/immutability-scenario.ts`
- `tests/firestore/operations.firestore.test.ts`
- `tests/firestore/immutability.firestore.test.ts`
- `SADIQ_PEARL_PHASE_8_REPORT.md`

**Modified**
- `firestore.rules`
- `scripts/test-security-rules.mjs`
- `README.md`
- `src/lib/config.ts`: hard-coded inquiry event list removed
- `src/components/BookingForm.tsx`
- `src/components/admin/AdminNav.tsx`
- `src/components/admin/RequestDecision.tsx`
- `src/app/(admin)/admin/calendar/page.tsx`
- `src/app/(admin)/admin/bookings/[bookingId]/page.tsx`
- `src/lib/booking/admin.ts`: `projectModificationPrice`
- `src/lib/booking/admin-api.ts`
- `src/lib/booking/admin-server.ts`: refund-adjustment state, calendar operational status, exported helpers
- `src/lib/booking/audit-model.ts`
- `src/lib/booking/store.ts`
- `src/lib/booking/firestore-store.ts`
- `src/lib/booking/testing/memory-store.ts`
- `tests/booking/finance.test.ts`

## Tests

All rows below were actually executed, on Windows 11, Node 24.18 and Next.js 16.3.7, unless they are marked NOT EXECUTED.

**Static checks and in-memory tests**

| Command | Environment | Result |
|---|---|---|
| `npx tsc --noEmit -p .` | static | **0 errors** |
| `npx eslint .` | static | **0 errors**, 1 pre-existing warning (`postcss.config.mjs`) |
| `npm run build` | production build | **Success**; public `/` and `/gallery` still static |
| `npm run test:booking` | **in-memory** transactional store | **180/180 pass** (43 suites) |

The 180 unit tests include:
- 18 Phase 8 operations tests;
- 1 in-memory 17-step immutability test;
- 1 refund-projection test;
- 48 Phase 7 finance tests;
- all Phase 3–6 tests.

**Browser and API (E2E)**

Each harness runs against a real server in **memory E2E mode** with the Auth **emulator**, using `node <harness>.mjs`.

| Harness | Result |
|---|---|
| `ops-e2e.mjs` (Phase 8) | **59/59** |
| `finance-e2e.mjs` | **56/56** |
| `portal-e2e.mjs` | **89/89** |
| `admin-panel-e2e.mjs` | **68/68** |
| `settings-e2e.mjs` | **44/44** |
| `booking-api.mjs` (store up) | **21/21** |
| `booking-ui.mjs` | **31/31** |
| `admin-e2e.mjs` | **9/9** |
| `auth-e2e.mjs` | **25/25** |
| `reset-e2e.mjs` | **26/26** |
| `logout-check.mjs` | copied cookie rejected in all cases |

`booking-ui.mjs` uses **mocked** availability and booking responses (Fetch interception), as since Phase 3.

`ops-e2e.mjs` (Phase 8) covers:
- **Authorisation:**
  - 5 admin pages: signed out → sign-in, customer → 404;
  - 7 mutation APIs: 401 / 403 / cross-site 403;
  - refused requests create nothing.
- **Vendors:** create, idempotent replay, invalid input, unknown fields, deactivate, inactive vendor not assignable.
- **Operations:** status changes, invalid transition (409), checklist item for a selected service, no item for unselected services, notes, assignment.
- **Clash and lifecycle:** vendor clash (409, naming the clash); a cancelled booking refused and missing from lists.
- **Lists:** filters for today, operational status and search.
- **Financial summary and isolation:**
  - payment summary on the sheet;
  - booking finances unchanged;
  - customer page shows no notes, vendors or phone numbers.
- **Carry-forward checks:** refund-adjustment state on the page and the API; public event types exclude an inactive type; the homepage inquiry form lists the configured types.
- **Browser flows:**
  - status change behind a confirmation dialog, which focuses a safe button first;
  - checklist, note and clash message in the UI;
  - Escape closes a dialog without acting.
- **Calendar:** Week, Day and Month views.
- **Responsive and accessibility:**
  - widths 320, 375, 390, 430, 768 and 1280 px;
  - no page overflow and no text under 12 px;
  - every form control labelled;
  - targets ≥ 40 px;
  - no console errors.

**Failure modes**

Real Firestore adapter, nothing listening on the Firestore port:

| Harness | Result |
|---|---|
| `booking-api.mjs MODE=down` | **23/23** |
| `portal-failure.mjs` | **8/8** |
| `admin-failure.mjs` | **6/6** |
| `inquiry-failure.mjs` (new) | **3/3**: 503 from the endpoint; the form falls back to free text with an honest message |

**Firestore emulator (NOT EXECUTED)**

| Command | Environment | Result |
|---|---|---|
| `npm run test:rules` (67 checks; Storage needs the same run) | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |
| `npm run test:booking:firestore` (engine, admin, finance, immutability, operations) | Firestore emulator | **NOT EXECUTED — ENVIRONMENT BLOCKER** |

**Harness maintenance (honest note).**
- Two `admin-panel-e2e.mjs` checks were adjusted.
- **Calendar cell selector:** narrowed to the day grid (`ol[aria-label^="Days in"] a[...]`). The new Month/Week/Day links also contain `date=…` and were being matched first. The assertion itself is unchanged.
- **Phase 8 E2E failures fixed in the app, not the tests:**
  - a wrong HTTP status for invalid transitions (400 → 409);
  - checklist and notes buttons that had the same name;
  - small touch targets in the week view and the vendor page.
- No assertion was weakened.

## Firestore Verification

| Item | Ran? |
|---|---|
| Firestore security-rules tests | **No.** Emulator blocked |
| Booking transaction tests (Firestore) | **No.** Emulator blocked |
| Financial transaction tests (Firestore), incl. 17-step immutability | **No.** Emulator blocked; passed **in memory only** |
| Phase 8 operational Firestore tests | **No.** Emulator blocked; the same scenario passed **in memory only** |
| Real Firebase project | **None exists.** Rules and indexes not deployed |

**To run them** (normal terminal, outside the agent sandbox, JDK 21+ on `PATH`, firebase-tools available):
```
npm run test:rules
npm run test:booking:firestore
```

## Known Limitations

- Real-Firestore verification is pending (above).
- Urdu text in PDFs prints as "?" until a licensed Urdu font and `@pdf-lib/fontkit` are added.
- No refund workflow exists; it needs a refund policy. Refund-requiring changes are blocked with an explicit message.
- Vendor clash detection is by date and slot. With one hall it matters only once more halls are configured, and no time-of-day overlap is modelled.
- No staff role: only the Super Admin can use operations (by design this phase).
- No notifications to vendors or customers (Phase 9).
- Public display paths may show configuration up to 30 s old on other server instances; writes always use fresh configuration.

## Business Data Still Required

Enter these in `/admin/settings` and `/admin/vendors`. None were invented.

- Real prices, advance rule and policies (cancellation, refund, modification).
- Confirm or remove the printed-card surcharge and 5% service charge.
- **Refund policy** and how refunds should be recorded.
- The vendors the venue works with (names, categories, phone/WhatsApp).
- Slot timings (Day/Night), if they are to be published.
- Services, menus and packages actually offered, so checklists reflect real selections.
- A licensed Urdu font file, if Urdu names must print on PDFs.
- Production domain (still unresolved).

Nothing from Phase 9+ was implemented: no WhatsApp/email/SMS automation, notifications, SEO/CMS, final audit
or launch. No commits were made.
