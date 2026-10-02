# Sadiq Pearl Marquee — Phase 7 Report
## Payments, Quotations & Receipts (+ Phase 6 carry-forward)

**Status: PHASE 7 IMPLEMENTATION COMPLETE — VERIFICATION BLOCKED**

Everything that can run in this environment is implemented and verified (unit, API, browser,
failure-mode and regression tests). The Firestore emulator still cannot start here (see §7), so the
real-Firestore tests (`npm run test:rules`, `npm run test:booking:firestore`, including the new
15-step financial scenario) were **NOT EXECUTED**. They have not been reported as passed.

---

## 1. What was built

| Area | Result |
|---|---|
| Manual/offline payments | Cash, bank transfer, cheque, other. Integer PKR, > 0, ≤ the remaining balance, date not in the future. Server-side validation; unknown fields (e.g. `balanceDue`, `status`, `receiptNumber`) are refused. |
| Concurrency | Each payment runs in one transaction that reads the booking and **all** its payments, re-checks the balance, then writes. Two admins at once cannot overpay; the losing transaction is retried and re-validated. |
| Idempotency | Payment ID = `pay_` + sha256(verified admin uid + form key). A double-click or network retry returns the same payment (`replayed: true`). |
| Corrections | Payments are never edited or deleted. **Void** needs a reason; the record and its receipt are kept and marked VOID, and totals are recalculated from the remaining payments. |
| Financial status | Derived, never stored: Pricing pending, Unpaid, Partially paid or Paid. Shown with the required advance, amount paid, remaining balance and the advance still due. |
| Price an unpriced booking | "Calculate & save price" uses the one pricing engine (`quote()`) with the current configuration. It works only when the booking has no price; an existing price is never recalculated. |
| Quotations | Draft → Issued → Superseded, and Discarded (unused draft). The draft copies the booking's **stored** price snapshot; there is no second pricing engine. `SPQ-YYYY-NNNNNN` is assigned at issue. Issuing supersedes the previous quotation. An issued quotation is never modified. A draft whose booking price changed can't be issued (`outdated`). |
| Receipts | One per payment, `SPR-YYYY-NNNNNN`. The full receipt snapshot (business, customer, event, booking reference, quotation number, total, paid before/after, remaining after) is stored on the payment. |
| PDFs | Built with pdf-lib **only from the stored snapshots**. They contain the logo, business details, customer, event, itemised lines, totals, advance, paid, remaining, policies, document number, booking reference and date. Superseded and draft quotations, and void receipts, are watermarked. |
| Admin UI | Booking page → **Payments & quotations**: summary, payment form with a confirmation step, history with receipt PDFs and Void, quotations with PDF, Issue and Discard. |
| Admin dashboard | The old "Payment data not configured" note is replaced by real booked value, received and outstanding amounts for upcoming priced bookings. If no booking is priced, it says so; no figures are estimated. |
| Customer portal | Booking page → **Quotations & receipts**: issued and superseded quotations, payment history, and receipt and quotation PDFs. It also shows a payment-status row, and "Advance received" is renamed "Paid". Read-only: no mutations. |
| Safety rule added | Approving a change that would make the price lower than the amount already paid is refused (`total_below_paid`). Nothing changes. |
| Security | All writes go through Super Admin APIs: same-origin, verified session, `super_admin` claim and verified email. `payments`, `quotations` and `counters` are deny-all for browsers in `firestore.rules`. PDFs are `private, no-store`, owner-or-admin only, and return 404 otherwise. Customer views exclude internal notes, void reasons and staff identities. |

## 2. Architecture

```
payments/{pay_<24hex>}     amount, method, paidAt, reference, notes, status(recorded|voided),
                           recordedBy, voided{at,by,reason}, receipt{…full snapshot…}
quotations/{qt_<32hex>}    quotationNumber|null, status, snapshot{business, customer, event,
                           services, menu, package, pricing(copy), requiredAdvance, paidToDate,
                           remaining, policies|null, generatedAt}, createdBy, issuedBy, issuedAt
counters/{quotation-YYYY|receipt-YYYY}   { value }   (allocated inside the same transaction)
bookings/{id}.payment      advanceReceived = TOTAL of recorded payments (name kept for
                           compatibility), balanceDue, paymentCount
```

- **Logic:** `src/lib/booking/finance.ts` holds `priceBooking`, `recordPayment`, `voidPayment`, `generateQuotation`, `issueQuotation`, `discardQuotation` and `validatePaymentInput`.
- **Model:** `finance-model.ts` holds the types, `financialSummary` and `financiallyOpen`.
- **Views:** `finance-view.ts` builds allow-listed admin and customer views.
- **Access:** `finance-access.ts` decides who may download which document.
- **PDFs:** `documents-pdf.ts`.
- **Server glue:** `finance-server.ts` takes the business details from `src/lib/config.ts` and loads the logo.
- **Store:** `BookingStore` and `BookingTransaction` were extended. Both implementations were updated: Firestore uses `create` / `lastUpdateTime` preconditions and the memory test store models them.
- **Memory store accuracy:** the test store now also rejects `undefined` field values, like Firestore without `ignoreUndefinedProperties`, so such bugs can't hide in tests.
- **Numbering:** sequential per year in the venue's time zone and allocated inside the transaction, so numbers are never reused. A number is consumed only when its document is committed.
- **Booking status:** a cancelled, rejected, expired or hold-lapsed booking accepts no new payments or quotations. Existing records stay available.

**API routes (new):**

| Route | Purpose |
|---|---|
| `POST /api/admin/bookings/{id}/price` | Price a booking that has no price |
| `POST /api/admin/bookings/{id}/payments` | Record a payment |
| `POST /api/admin/payments/{id}/void` | Void a payment |
| `POST /api/admin/bookings/{id}/quotations` | Generate a quotation draft |
| `POST /api/admin/quotations/{id}/issue` | Issue a draft |
| `POST /api/admin/quotations/{id}/discard` | Discard a draft |
| `GET /api/documents/quotations/{id}` | Quotation PDF |
| `GET /api/documents/receipts/{paymentId}` | Receipt PDF |

## 3. Verification results (all actually executed)

| Check | Result |
|---|---|
| TypeScript `tsc --noEmit` | **0 errors** |
| ESLint | **0 errors**, 1 warning (pre-existing, `postcss.config.mjs`) |
| Production build `next build` | **Success**; all new routes listed |
| Unit tests `npm run test:booking` | **160/160 pass** (47 new in `tests/booking/finance.test.ts` + 113 earlier) |
| Finance E2E: real server, Auth emulator, memory store | **56/56** |
| Regressions: customer portal / admin panel / Phase 6 settings | **89/89 / 68/68 / 44/44** |
| Regressions: booking API (store up) / booking API (database down) / booking UI | **21/21 / 23/23 / 31/31** |
| Regressions: admin foundation / auth / password reset & session / logout re-check | **9/9 / 25/25 / 26/26 / all rejected** |
| Regressions: portal failure states / admin failure states | **8/8 / 6/6** |
| Firestore rules `npm run test:rules` | **NOT EXECUTED**: emulator blocker (§7) |
| Firestore booking tests `npm run test:booking:firestore` (incl. finance) | **NOT EXECUTED**: emulator blocker (§7) |

**Finance unit tests** (`tests/booking/finance.test.ts`, in-memory transactional store) cover:

- **Validation:** 0, negative, fractional, string, NaN, Infinity and huge amounts; unknown method; future or impossible date; long reference; missing key; browser-supplied balance, status, receipt number or total.
- **Payments:**
  - a valid payment, with its receipt snapshot, totals and audit record;
  - several payments with sequential numbers, ending as "Paid", then `already_paid`;
  - overpayment, which writes no payment, no number and no audit record;
  - unpriced, cancelled, rejected, hold-lapsed and unknown bookings, all refused;
  - idempotent replay and a reused key;
  - payment ID derivation.
- **Concurrency:**
  - two admins overpaying at once: exactly one succeeds and the loser is retried;
  - ten concurrent payments: numbers are unique and gap-free, and an aborted attempt writes nothing;
  - payments racing on different bookings;
  - a payment racing a void.
- **Void:** the record and receipt are kept, totals are recalculated and the reason is audited. A second void, a missing reason and an unknown ID are refused. A new payment after a void gets a new number.
- **Pricing:** missing prices are listed; pricing happens once; an existing price is never recalculated; stale page.
- **Quotations:**
  - the draft is a copy of the stored snapshot, even when current prices differ;
  - policies appear only when active;
  - numbering is sequential, a new draft discards the old one, and issuing supersedes;
  - immutability: a price increase plus an approved change leaves the issued quotation untouched and flags it out of date; an outdated draft can't be issued;
  - `total_below_paid`.
- **Tenant isolation:**
  - the owner can download, another customer can't, and drafts are hidden;
  - an admin with an unverified email is refused;
  - documents of offline (walk-in) bookings are admin-only;
  - customer views leak no notes, staff identities or void reasons.
- **PDFs:** valid PDFs for receipts, quotations, void receipts and drafts; the receipt snapshot is unchanged after later changes; Urdu text is replaced safely instead of crashing.

**Finance E2E** (`finance-e2e.mjs`) checks:

- **Authorisation on all 5 mutation APIs:** no session gets 401, a customer gets 403, a cross-site request gets 403.
- **Validation and business rules over HTTP:**
  - every invalid payment type is refused;
  - unpriced bookings are refused;
  - the draft → issue flow works, and re-issuing is refused;
  - the same payment submitted twice is replayed, not recorded twice;
  - overpayment is refused with the remaining amount;
  - two admins paying at once: exactly one 201 and one 409.
- **PDFs:**
  - correct headers (`application/pdf`, `no-store`);
  - no internal notes inside;
  - another customer gets 404, a signed-out user gets 401, a malformed ID gets 404;
  - drafts are hidden from customers.
- **Void and pricing:** void works and a second void is refused; an unpriced booking can be priced once.
- **Browser, admin panel:** the form blocks overpayment before sending; there is a confirmation dialog; the summary updates; the quotation is issued through the UI; void without a reason is blocked.
- **Browser, customer portal:** quotations and receipts appear, there are no action buttons, and no data leaks.
- **Layout and console:** no horizontal overflow at 390 px or 1440 px; no console errors; the dashboard shows real figures.

The PDFs were opened and inspected visually.

**Harness maintenance (honest note).**
- Two old seed generators were stale since Phase 6:
  - `admin-seed.ts` called `validateChangeRequest` without the Phase 6 config argument;
  - `portal-seed.ts` used the removed Phase 3 `pricing` option.
- Both were ported to the config API with the **same test prices**. Fixture menus were priced at 0, matching the old price list, which didn't charge for menus.
- Two assertions were updated for **intended** Phase 7 text changes:
  - "Advance received" became "Paid";
  - the receipts empty state changed, and still shows no fake receipts.
- One assertion was updated for the dashboard: "Payment data not configured" became "No priced upcoming bookings" when nothing is priced, still with no amounts shown.
- No assertion was loosened to hide a failure.

## 4. Firestore rules & indexes

- **New rules:** `payments`, `quotations` and `counters` are `allow read, write: if false` (Admin SDK only).
- **New rules tests (10):** in `scripts/test-security-rules.mjs` (58 checks in total). A customer can't record, read, list, void or delete payments, create or read quotations, change counters, or mark their booking paid; a signed-out visitor can't read payments.
  - These tests are **not executed** here (§7).
- **Indexes:** none needed. New queries are single-field equality (`payments.bookingId`, `quotations.bookingId`) with sorting done in memory, which Firestore's automatic indexes serve. `firestore.indexes.json` is unchanged.
  - Indexes are verified by reading the queries; there is no live project to deploy to.

## 5. Behaviour changes to note

1. **Field name:** `bookings.payment.advanceReceived` now means "total paid", the sum of recorded payments. Its name was kept to avoid a data migration.
2. **Change approvals:** approving a change can now fail with `total_below_paid`. **Refunds are not modelled**; they need a refund policy from the business.
3. **Dashboard:** the payments panel shows real totals.

## 6. Business data still required

- Real prices (hall rent, per-guest rate, menus, services, packages), advance rule and policies are still **not configured**. Until an admin enters them in Settings, bookings stay "Pricing pending" and no payment can be recorded.
- **Confirm or remove** the printed-card rules pre-filled since Phase 3: below 300 guests, +Rs 300 per guest; 5% service charge.
- **Refund policy and refund handling:** refunds are not recorded as negative payments.
- **Wording printed on quotations and receipts:**
  - extra text (NTN/tax number, bank account for transfers, signature or stamp);
  - whether quotations need a validity period.
- **Urdu names:** PDF text uses Helvetica, so Urdu script prints as "?". An Urdu/Nastaliq font file (licence-cleared) is needed to print Urdu names.
- **Production domain:** still unresolved (Phase 0 P0-1).

## 7. Carry-forward: Firestore emulator blocker (not resolved)

- **Attempts this phase:** `npm run test:rules` and `npm run test:booking:firestore` were run again with JDK 25 (`C:\Program Files\Eclipse Adoptium\jdk-25.0.3.9-hotspot`). Both failed the same way, and `firestore-debug.log` shows: `ChannelException: failed to open a new selector`.
- **Cause:** on Windows, Java's `Selector.open()` creates an internal AF_UNIX pipe. The connect step of that pipe is refused inside this agent's sandbox ("Invalid argument: connect"). A minimal standalone Java program reproduces it, so the cause is the environment, not the project.
- **Not attempted:** the JDK `--patch-module` workaround and running outside the sandbox were declined earlier and were not tried.
- **To run them yourself** (normal terminal, JDK 21+ on `PATH`, firebase-tools installed):
  ```
  npm run test:rules
  npm run test:booking:firestore
  ```
  The second command now also runs `tests/firestore/finance.firestore.test.ts`, the 15-step real-Firestore financial scenario. It was **checked only against the in-memory store** (a temporary copy, deleted afterwards). Its logic passes there, but that is **not** a Firestore result.
- **No real Firebase project or credentials** exist, so rules and indexes have not been deployed.

## 8. Changed files (Phase 7)

**New**
- `src/lib/booking/finance-model.ts`
- `src/lib/booking/finance.ts`
- `src/lib/booking/finance-view.ts`
- `src/lib/booking/finance-access.ts`
- `src/lib/booking/finance-server.ts`
- `src/lib/booking/documents-pdf.ts`
- `src/components/admin/FinancePanel.tsx`
- `src/app/api/admin/bookings/[bookingId]/price/route.ts`
- `src/app/api/admin/bookings/[bookingId]/payments/route.ts`
- `src/app/api/admin/bookings/[bookingId]/quotations/route.ts`
- `src/app/api/admin/payments/[paymentId]/void/route.ts`
- `src/app/api/admin/quotations/[quotationId]/issue/route.ts`
- `src/app/api/admin/quotations/[quotationId]/discard/route.ts`
- `src/app/api/documents/quotations/[quotationId]/route.ts`
- `src/app/api/documents/receipts/[paymentId]/route.ts`
- `tests/booking/finance.test.ts`
- `tests/firestore/finance.firestore.test.ts`
- `SADIQ_PEARL_PHASE_7_REPORT.md`

**Modified**
- `package.json` / `package-lock.json`: `pdf-lib` 1.17.1, exact version
- `firestore.rules`
- `scripts/test-security-rules.mjs`
- `README.md`
- `src/lib/booking/store.ts`
- `src/lib/booking/firestore-store.ts`
- `src/lib/booking/testing/memory-store.ts`
- `src/lib/booking/model.ts`
- `src/lib/booking/audit-model.ts`
- `src/lib/booking/admin.ts`: `total_below_paid`
- `src/lib/booking/admin-api.ts`: error messages
- `src/lib/booking/admin-server.ts`: detail and dashboard data
- `src/lib/booking/portal-server.ts`
- `src/components/account/BookingSections.tsx`
- `src/app/(admin)/admin/page.tsx`
- `src/app/(admin)/admin/bookings/[bookingId]/page.tsx`
- `src/app/(account)/account/bookings/[bookingId]/page.tsx`

Nothing from Phase 8+ was implemented: no event operations, vendors, operations calendar, WhatsApp/email
automation, SEO/CMS, final audit or launch. No commits were made.
