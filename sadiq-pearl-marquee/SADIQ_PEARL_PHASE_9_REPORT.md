# Sadiq Pearl Marquee — Phase 9 Report
## WhatsApp / Notifications / Communication

**Status:** Phase 9 implementation is complete.

Verification is partly open:

- **Firestore emulator tests:** NOT EXECUTED — ENVIRONMENT BLOCKER (§16).
- **Browser regression re-run:** the latest run happened while the machine's CPU was at 100% because of non-project processes (§15). In it, 4 UI checks failed (3 admin-panel, 1 ops). These are listed as open, not as passed.

Nothing in this report claims a result that was not actually produced.

---

## 1. What was implemented

- **In-app notifications** for customers with an online account.
  - Each one is created **in the same Firestore transaction** as the real change it describes: booking status, change and cancellation requests, quotation issue, payment recorded or voided.
  - Each one is created exactly once.
  - Text is customer-safe and historical: it is never rewritten.
- **Customer UI:**
  - a "Notifications" item with an unread badge in the account navigation (the count is shown in text too, not only colour);
  - an `/account/notifications` page with a list, mark one read, mark all read, pagination ("Older notifications"), "You're all caught up." for an empty list, and an error state with retry.
- **Manual WhatsApp workflow (admin):**
  - centralised message templates, built **on the server from authoritative records**;
  - a preview before opening;
  - a communication record with status **"initiated"** (the only provable state), written with an audit entry, then the `wa.me` link.
  - It is available on the booking page (customer) and on the event sheet (vendor, using the vendor record's own number).
- **Communication history:**
  - on the admin booking page (in-app notifications plus WhatsApp records);
  - in an **admin communication center**, `/admin/communications`, with filters for date range, channel, type and search;
  - a "Delivery channels" panel that says plainly what is and isn't configured.
- **Customer → venue support:** the existing WhatsApp support link now uses the central template (`supportMessage`) with real booking context only.
- **Security:**
  - Firestore rules for `notifications` (owner read only, no browser writes) and `communications` (no browser access);
  - 10 new rules tests;
  - one composite index;
  - rate limiting on communication endpoints.

## 2. Communication architecture

```
booking engine / change requests / finance  ──(same transaction)──▶ notifications/{nt_…}   (in-app, customer)
admin WhatsApp composer ──▶ POST /api/admin/communications/whatsapp
        ├─ preview: server builds text from records (nothing stored)
        └─ initiate: communications/{cm_…} status "initiated" + adminAudit, then returns https://wa.me/<digits>?text=…
```

| Concern | File |
|---|---|
| Data model and in-app templates | `src/lib/booking/notifications.ts` |
| WhatsApp templates, phone normalisation, link builder | `src/lib/booking/whatsapp-messages.ts` |
| Read state and manual WhatsApp transactions | `src/lib/booking/communications.ts` |
| Server loaders and business contact | `src/lib/booking/communications-server.ts` |
| Flood protection | `src/lib/booking/rate-limit.ts` |

- **Source of truth is unchanged.** Booking, slot, customer, payments, quotations, receipts, operations, vendors and configuration stay authoritative.
- **Snapshots only.** Notifications and communication records hold only the text sent at that moment (a historical snapshot). They are never used as current state.
- **Provider-ready.** The channel model (`channel`, `DELIVERY_PROVIDERS`) lets a real provider be added later, as a separate channel with its own provable states. No provider is faked.

## 3. Notification data model

`notifications/{notificationId}`:

| Field | Meaning |
|---|---|
| `notificationId` | `nt_` + sha256(customerId + dedupeKey) |
| `customerId` | Taken from the booking, never from a request |
| `bookingId` | The booking it is about |
| `type` | One of the types in §4 |
| `title`, `message` | Snapshot text, customer-safe |
| `actionUrl` | Only `/account/...`, validated again when rendered |
| `metadata` | Small, customer-safe values (reference, amounts, document numbers) |
| `channel` | `"in_app"` |
| `dedupeKey` | Identifies the event |
| `createdAt`, `readAt` | `readAt` is null until read |

No tokens, passwords, internal notes, decision or void reasons, staff identities, or vendor data are stored.

`communications/{communicationId}`:

| Field | Meaning |
|---|---|
| `communicationId` | `cm_` + sha256(adminUid + form key) |
| `channel` | `"manual_whatsapp"` |
| `recipient` | `{kind: customer \| vendor, customerId, vendorId, name, phone}` |
| `bookingId`, `template` | What the message is about |
| `message` | Snapshot of the exact text |
| `status` | `"initiated"` |
| `initiatedBy`, `createdAt` | Who opened it, and when |

## 4. Notification types

These are real workflows only:

| Area | Types |
|---|---|
| Booking | `BOOKING_SUBMITTED`, `BOOKING_CREATED_BY_STAFF`, `BOOKING_UNDER_REVIEW`, `BOOKING_CONFIRMED`, `BOOKING_REJECTED`, `BOOKING_CANCELLED`, `BOOKING_EXPIRED` (a pending hold taken over), `BOOKING_COMPLETED` |
| Requests | `MODIFICATION_REQUESTED/APPROVED/REJECTED`, `CANCELLATION_REQUESTED/APPROVED/REJECTED` |
| Finance | `QUOTATION_ISSUED`, `PAYMENT_RECEIVED` (includes the receipt number; receipt and payment are created together, so there is no separate receipt notification), `PAYMENT_VOIDED` |

- **Event changes:** a date or slot change is covered by `MODIFICATION_APPROVED`. Its message gives the new and the previous date and slot; the old confirmation is never rewritten.
- **Operations:** internal operational status, checklist, vendors and notes are never exposed.
- **Walk-in bookings** (no account) get no in-app notification.

## 5. WhatsApp implementation

**Templates** (`buildWhatsAppMessage`):

| Template | Allowed when | Content |
|---|---|---|
| booking confirmation | booking is confirmed | event details, plus total / paid / remaining, or "Price: Pending" if there is no price |
| payment confirmation | a **recorded** payment of **this** booking | amount, method, receipt number, remaining after |
| quotation | an **issued** quotation of this booking | number, total, advance (or "Pending") |
| event reminder | confirmed and upcoming | event details |
| general | always | booking context only |
| vendor event details | vendor assigned to a confirmed event | logistics only, no customer contact, no money |

**Phone safety:**
- `normalizeWhatsAppNumber` accepts clear Pakistani mobile numbers (`03xx…`, `+92…`, `0092…`) and clean international numbers.
- It refuses landlines and anything unclear (no guessing). An unusable number is shown in the UI.

**Link safety:**
- `whatsAppLink` produces only `https://wa.me/<digits>?text=<encodeURIComponent>`; it throws on anything else.
- The client checks the returned URL starts with `https://wa.me/` before opening it.
- No URL is taken from input, so there is no open redirect.

**Venue number:** customer → venue links still use the single configured number (`business.whatsappNumber` in `src/lib/config.ts`, used through `src/lib/whatsapp.ts`).

**Pop-up blocked:**
- The admin stays on the page.
- A "Message recorded … use 'Open WhatsApp' below" notice and a `wa.me` link are shown.
- The panel never navigates away (this was found and fixed during E2E).

**No dependency added.** No SDK is needed to build `wa.me` links.

## 6. Manual vs automated delivery status

| Channel | Status | What is claimed |
|---|---|---|
| In-app notification | Active | "Created", and "Read" once the customer reads it |
| WhatsApp (manual) | Available | "Initiated — WhatsApp opened by staff (delivery not tracked)"; UI: "WhatsApp opened. Delivery is handled by WhatsApp…" |
| Automated WhatsApp (Business API) | **Not configured** | Nothing; no credentials exist |
| Email / SMS | **Not configured** | Nothing; no provider exists |

"Sent" or "delivered" is never shown or stored for any message.

## 7. Admin communication functionality

- **Booking page "Communication" panel:**
  - the template choice is built only from real records (confirmed status, issued quotations, recorded payments);
  - preview, then "Open in WhatsApp";
  - history of in-app notifications and WhatsApp records for the booking.
- **Event sheet:** "WhatsApp <vendor>" per active assignment, with the vendor's own number from the vendor record.
- **`/admin/communications`:**
  - date range capped at 92 days, at most 300 records per kind;
  - filters for channel, type and customer / vendor / booking reference;
  - the delivery-channel status panel.
- **Messaging never changes anything else.** No booking, payment, quotation, receipt, operation or vendor is changed by messaging (tested).

## 8. Customer notification functionality

- **Navigation badge:** the real unread count from Firestore (`count()` aggregation), read fresh on every account render; never cached and never hard-coded. If the count can't be read, no number is shown (no made-up number).
- **`/account/notifications`:**
  - 20 per page, newest first, "Older notifications" pagination;
  - New / Unread / Read shown as text;
  - "View booking" (internal link only) marks the notification read;
  - "Mark as read" and "Mark all as read".
- **Empty state:** "You're all caught up."
- **Error state:** "Your notifications can't be shown right now" with "Try again" and WhatsApp support.

## 9. Security

- **Customers:**
  - the session uid is derived on the server;
  - a notification that isn't theirs is "not found" (404);
  - only `readAt` can change, through `POST /api/account/notifications/read`, which is same-origin, session-checked, and accepts only `notificationId` or `all` (other fields → 400);
  - customers cannot create notifications or change type, owner, text or status.
- **Admin:**
  - `POST /api/admin/communications/whatsapp` uses `adminMutation` (same-origin, verified session, `super_admin` claim, verified email);
  - request fields are allow-listed, and a client-supplied `status` is refused;
  - referenced payments, quotations and assignments must belong to the booking (`booking_mismatch`, `record_not_found`).
- **Rate limiting** (in-process sliding window, per server instance):
  - WhatsApp initiate: 20/min per admin;
  - WhatsApp preview: 60/min per admin;
  - mark-read: 60/min per customer.
- **Vendor contact details** never reach customer pages or customer notifications (tested).

## 10. Firestore rules

```
match /notifications/{id}   { allow get, list: if signedIn() && resource.data.customerId == request.auth.uid;
                              allow create, update, delete: if false; }
match /communications/{id}  { allow read, write: if false; }
```

**10 new rules tests** in `scripts/test-security-rules.mjs`, 77 checks in total:

- Allowed:
  - own notification readable;
  - own list query allowed.
- Refused:
  - another customer's notification;
  - listing all notifications;
  - creating a notification;
  - marking read directly or changing the owner;
  - deleting a notification;
  - reading communications;
  - writing a communication;
  - signed-out read.

**Index:** one new composite index, `notifications (customerId ASC, createdAt DESC)`, used by the customer list. All other queries use single-field or equality-only automatic indexes.

## 11. Audit trail

- **New action:** `whatsapp_initiated` (entityType `communication`) in the existing `adminAudit` trail, written in the same transaction as the communication record.
- **Audit content:** template, recipient kind and channel. **No message text and no phone number.**
- **Automatic notifications** are not separately audited. They are part of the audited change itself (status changes, decisions and finance actions already have audit records).

## 12. Idempotency strategy

- **One notification per change.** A notification is written in the same transaction as its change. The change itself happens once:
  - status transitions are one-way;
  - a decided request can't be decided again;
  - payments and vendors already have idempotent IDs.
- **Event-derived IDs:** `nt_` = hash(customerId + dedupeKey), e.g. `booking:<id>:confirmed`, `request:<id>:approved`, `payment:<id>:recorded`, `quotation:<id>:issued`. The record is written with `create()`, so the same event can never be stored twice.
- **Tested:**
  - repeated confirm (refused, nothing added);
  - replayed booking request;
  - replayed payment;
  - same notification ID for the same event at a different time.
- **Manual WhatsApp:** `cm_` = hash(admin uid + form key). The same submission returns the same record (`replayed`), never a second one.

## 13. Retry / failure handling

- **In-app notification.** It is part of the same commit as its change.
  - If it can't be written, the whole action fails visibly: the admin sees "The database didn't respond…", and nothing is half-done.
  - A retry performs the change once and creates the notification once.
  - Tested with a simulated write failure: the booking stays pending and there is no notification; the retry gives exactly one.
  - This trades "the action may fail if the database fails" for "never a missing or duplicate notification". Since both live in the same database, a notification failure is a database failure.
- **Manual WhatsApp.** If recording fails, no link is returned and nothing is opened; an error is shown. A retry with the same form key is idempotent.
- **No external provider exists**, so there is no delivery queue and no "failed delivery" state. When a provider is added, its delivery attempts should get their own provable states (pending / sent / failed) in a separate record.
- **Retries never touch other records.** They never duplicate or mutate payments, bookings, quotations or receipts (tested).

## 14. Tests

**Unit and in-memory tests** (`npm run test:booking`):
- `tests/booking/notifications.test.ts`: 15 tests;
- the shared scenario `tests/booking/notifications-scenario.ts`, which also runs on the emulator.

They cover:
- creation for submitted, under review, confirmed, rejected, cancelled, completed and expired, for the right customer and booking;
- staff bookings (linked customer vs walk-in);
- modification and cancellation requested / approved / rejected;
- refused approvals (`total_below_paid`) creating nothing;
- quotation issued, payment received with the real receipt, payment voided;
- payment replay creating no duplicate;
- event-derived IDs;
- simulated write failure plus retry;
- ownership (mark read and mark all by another customer);
- unread count;
- history not rewritten after a modification;
- internal reasons never exposed;
- only `/account` links rendered;
- WhatsApp number normalisation, link encoding, no open redirect, templates refusing non-existent states, "Pending" instead of invented prices;
- WhatsApp records "initiated" only, preview recording nothing, audit holding no text or phone, idempotent replay, the booking unchanged;
- payment / quotation of another booking refused, unusable phone refused;
- vendor messages using the vendor record and carrying no customer contact or prices.

**Firestore emulator:** `tests/firestore/notifications.firestore.test.ts` runs the same scenario (blocked, §16).

**E2E:** `comm-e2e.mjs`, 49 checks, browser plus API (details in §15).

## 15. Exact test results

Environment: Windows 11, Node 24.18, Next.js 16.3.7.

**Static checks, build and unit tests**

| Command / harness | Environment | Result |
|---|---|---|
| `npx tsc --noEmit -p .` | static | **0 errors** |
| `npx eslint .` | static | **0 errors**, 1 pre-existing warning (`postcss.config.mjs`) |
| `npx next build` (production env) | build | **Success**, after the main Phase 9 code |
| `npx next build` (emulator-wired test env) | build | **Success**, latest code |
| `npm run test:booking` | **in-memory** store | **195/195 pass** (51 suites; 15 new Phase 9 tests) |

Note on the production build: later small changes were the blocked-pop-up handling, the history titles and the test seed counters. They were built successfully in the test build; a final production-env build is still to be re-run (§19).

**Phase 9 E2E**

| Harness | Environment | Result |
|---|---|---|
| `comm-e2e.mjs` (Phase 9) | real server, memory store, Auth emulator, headless Chrome | **49/49** in five separate runs, including the full suite run |

**Regression suite**

| Harness | Result in full suite (18:30–19:31) | Re-run (CPU at 100%) |
|---|---|---|
| `portal-e2e.mjs` | 88/89 | **89/89** |
| `admin-panel-e2e.mjs` | 59/68 | **65/68: 3 open** (below) |
| `settings-e2e.mjs` | 42/44 | **44/44** |
| `finance-e2e.mjs` | 51/56 | **56/56** |
| `ops-e2e.mjs` | 54/59 | **58/59: 1 open** ("Status moved to Preparing via the UI", read after a fixed pause) |
| `booking-api.mjs` (up / down) | **21/21 / 23/23** | — |
| `booking-ui.mjs` (mocked availability API) | **31/31** | — |
| `admin-e2e.mjs`, `auth-e2e.mjs`, `reset-e2e.mjs` | **9/9, 25/25, 26/26** | — |
| `logout-check.mjs` | copied cookie rejected in all cases | — |
| `portal-failure.mjs`, `admin-failure.mjs`, `inquiry-failure.mjs` (database down) | **8/8, 6/6, 3/3** | — |

**Why the full-suite failures happened.**
- The machine's CPU was at **100%**, mostly `ScreenRecorder` and `audiodg`; these are not project processes and were not touched. `/login` took 37.7 s to respond.
- The older harnesses used a fixed 2.5 s wait after navigation, so they clicked before pages had hydrated.
- They were changed to wait for page load, `<main>` and hydration, and for each clicked element to hydrate (`patch-waits.mjs`). This is a timing-only change; **no assertion was changed**.

**Open items (not counted as passed).** One `ops-e2e` UI check ("Status moved to Preparing via the UI") and these 3 `admin-panel-e2e` UI checks still failed in the busy re-run:
- "Modification review shows current booking, requested change, current slot state, customer note";
- "Approved: booking moved (date/slot/guests) atomically";
- "Cancellation approved: booking Cancelled, slot released".

The **server-side checks around them passed in the same run**: the new slot is booked and the old one released; the cancellation dialog states no refund is calculated. The failing checks read page text after a fixed 1.5 s pause.

These approval paths now also write notifications, and the booking page now loads communication history. A real Phase 9 regression can't be ruled out until these are re-run on an idle machine.

**Harness and seed changes (honest note).**
- `comm-seed.ts` now seeds the receipt and quotation counters. Without them, a seeded payment and a new payment received the same receipt number, because counters live in their own documents. In production the counter and the payment are written together, so this can't happen there.
- The memory test store's `seed()` gained `counters` for this.
- No production logic was changed for tests.

## 16. Firestore verification status

| Item | Result |
|---|---|
| `npm run test:booking:firestore` (engine, admin, finance, immutability, operations, notifications) | **NOT EXECUTED — ENVIRONMENT BLOCKER.** `Firestore Emulator has exited with code: 1`; `firestore-debug.log`: `io.netty.channel.ChannelException: failed to open a new selector` |
| Rules tests, Firestore part (`firebase emulators:exec --only firestore … "node scripts/test-security-rules.mjs --only=firestore"`; the standard `npm run test:rules` needs port 9099, which the running Auth emulator was using) | **NOT EXECUTED — ENVIRONMENT BLOCKER**, same error |
| Real Firebase project | None exists; rules and indexes not deployed |

- **Cause:** unchanged since Phase 7. Java's internal loopback pipe (`Selector.open()`) is refused inside this agent's sandbox.
- **No Firestore claim:** in-memory results are **not** Firestore results.
- **To run them** (your own terminal, JDK 21+):
  ```
  npm run test:rules
  npm run test:booking:firestore
  ```

## 17. Changed files

**New**
- `src/lib/booking/notifications.ts`
- `src/lib/booking/whatsapp-messages.ts`
- `src/lib/booking/communications.ts`
- `src/lib/booking/communications-server.ts`
- `src/lib/booking/rate-limit.ts`
- `src/app/api/account/notifications/read/route.ts`
- `src/app/api/admin/communications/whatsapp/route.ts`
- `src/app/(account)/account/notifications/page.tsx`
- `src/app/(admin)/admin/communications/page.tsx`
- `src/components/account/NotificationList.tsx`
- `src/components/admin/WhatsAppComposer.tsx`
- `src/components/admin/CommunicationHistory.tsx`
- `tests/booking/notifications.test.ts`
- `tests/booking/notifications-scenario.ts`
- `tests/firestore/notifications.firestore.test.ts`
- `SADIQ_PEARL_PHASE_9_REPORT.md`

**Modified**
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/test-security-rules.mjs`
- `README.md`
- `src/lib/booking/engine.ts`: notifications for booking creation, status changes and expiry
- `src/lib/booking/customer.ts`: change and cancellation request notifications
- `src/lib/booking/admin.ts`: decision notifications
- `src/lib/booking/finance.ts`: quotation and payment notifications
- `src/lib/booking/store.ts`
- `src/lib/booking/firestore-store.ts`
- `src/lib/booking/testing/memory-store.ts`
- `src/lib/booking/audit-model.ts`
- `src/app/(account)/layout.tsx`: unread count
- `src/components/account/PortalNav.tsx`: Notifications item and badge
- `src/components/account/PortalStates.tsx`: `PortalError` subject
- `src/app/(account)/account/bookings/[bookingId]/page.tsx`: central support message
- `src/app/(admin)/admin/bookings/[bookingId]/page.tsx`: Communication panel
- `src/app/(admin)/admin/events/[bookingId]/page.tsx` and `src/components/admin/EventOps.tsx`: vendor WhatsApp
- `src/components/admin/AdminNav.tsx`: Communications
- `src/components/Icon.tsx`: bell icon

## 18. Dependencies added

**None.** `wa.me` links are plain URLs. Rate limiting and hashing use built-ins.

## 19. Known limitations

- **Firestore emulator verification is pending** (§16).
- **Four UI checks are open** (3 admin-panel, 1 ops; §15); re-run them on an idle machine. A final production-env `next build` should also be re-run after the last small changes.
- **WhatsApp delivery** can't be tracked (manual mode). There is no automated WhatsApp, email or SMS (no provider).
- **No reminders:** no scheduled-job infrastructure exists, so no automatic reminders are sent. The manual "Event reminder" template exists; automatic reminders need a scheduler (e.g. Cloud Scheduler + a server job), added later.
- **Rate limits** are per server instance (in-process), not a global quota.
- **No notification preferences.** In-app notifications are transactional service messages and are always on. No automated channel exists, so a channel preference would imply delivery that doesn't exist.
- **No editable templates** in Settings. The text is centralised in code, so security-sensitive values always come from server records. Editable wording can be added later with placeholders rendered on the server.
- **Mobile navigation:** at 320 px, the account navigation scrolls horizontally inside its own bar (existing pattern). The Notifications item may need a swipe to see.
- **Walk-in bookings** (no account) get no in-app notifications. Staff use manual WhatsApp.

## 20. Business information still required

- Confirm WhatsApp as the official customer channel, and which number staff should message from. Manual mode opens WhatsApp on the staff member's own device or account.
- If automated messaging is wanted: a WhatsApp Business API provider account and approved message templates (not created here; no credentials invented).
- Email sender and provider, if email is wanted.
- Desired reminder timing, if automatic reminders are wanted later.
- Still open from earlier phases:
  - real prices, advance rule and policies (including the refund policy);
  - confirmation of the printed-card surcharge and service charge;
  - the vendors the venue uses;
  - slot timings;
  - a licensed Urdu font for PDFs;
  - the production domain.

## 21. Deferred to Phase 10+

Not implemented in Phase 9:

- SEO / CMS
- gallery and reviews
- WhatsApp Business API / email / SMS providers
- scheduled reminders
- notification preferences
- final security and performance audit
- production launch

No commits were made.
