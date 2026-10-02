# Sadiq Pearl Marquee — Official Venue Policies

Date: 2026-10-02.

## Source, read first

- **The policy-card image itself was not available.** No image was attached to the request.
  - The only recent image in Downloads (`WhatsApp Image 2026-09-29 at 22.58.56.jpeg`) is a stage photo, not a policy card.
  - The project's own card images (`public/menu/sheet-1..3.jpg` and the menu-card PDF) contain menus only.
- **Sources actually used:**
  1. **The user's request**, which explicitly names:
     - the under-300-guest charge of Rs. 300 per person;
     - AC Rs. 20,000 for one hour;
     - the 5% service charge;
     - customer responsibility for valuables during the event and while vacating the hall;
     - fireworks / firing responsibility;
     - the non-refundable advance.
  2. **`POLICY_CARD_EXTRACTED.md`** inside the user's `Downloads\Sadiq_Pearl_Policy_Update_Claude_Prompt.zip`, a text extraction of the card supplied by the user.
  3. **The terms already in the project** (`src/data/menu.ts`), which earlier phases transcribed from the venue's printed card and listed as CONFIRMED in the README's "Content status".
- The Urdu text was **not re-read by me**. Where the sources disagree, or a point appears in only one of them, it is listed under §5 / §6 as requiring confirmation instead of being guessed.

## 1. Policies extracted

The single source is now `src/data/policies.ts` (`OFFICIAL_VENUE_TERMS`).

| # | Policy (as stored) | Supported by |
|---|---|---|
| 1 | **Minimum guests:** all services are for a minimum of 300 guests. For fewer guests, an extra Rs. 300 per head is charged. | request, extraction, existing terms |
| 2 | **Outside catering & decoration:** catering or decoration from outside is strictly not allowed. | existing terms (not in the extraction; see §6) |
| 3 | **Cleanliness & breakage:** responsibility for cleanliness and for any breakage rests with the customer. | extraction only (**new**; see §6) |
| 4 | **Your belongings:** during the function and when leaving the hall, you are responsible for keeping your valuables safe. | request, extraction ("during Nikah"; see §5), existing terms |
| 5 | **AC charges:** Rs. 20,000 for one hour. | request, extraction, existing terms |
| 6 | **Fireworks & firing:** strictly prohibited; the person who books the hall is fully responsible for any violation. | request, extraction, existing terms |
| 7 | **Service charges & extra time:** 5% service charges apply. Extra time is charged at Rs. 20,000 per hour. | 5%: request, extraction, existing terms. Extra time: existing terms only (see §6) |
| 8 | **Extra services:** extra decoration, extra lighting, sound system and other extra services are charged separately. | existing terms (see §6) |
| 9 | **Taxes & advance:** all government taxes and regulations apply to the customer. The advance amount is non-refundable. | request (advance), extraction (tax wording without a rate; advance), existing terms |

## 2. Policies that affect pricing

| Rule | How it is applied |
|---|---|
| Fewer than 300 guests → Rs. 300 extra per guest | Already the configuration default `pricing.smallEventSurcharge = { belowGuests: 300, perGuest: 300 }`, applied by the **existing** `quote()` as a "Surcharge below 300 guests" line. It was marked "requires confirmation" before; it is now marked CONFIRMED. No value changed. |
| 5% service charge | Already the default `pricing.serviceChargePercent = 5`, applied by `quote()` after any discount. Now marked CONFIRMED. No value changed. |

- No second formula was added. The values live only in the business configuration, and the admin can still edit them in Settings → Pricing.
- **Historical bookings, quotations and receipts are unchanged.** Prices are stored snapshots and nothing was recalculated.
- **Not connected to pricing:**
  - **AC Rs. 20,000 / hour** and **extra time Rs. 20,000 / hour.** The pricing engine prices per booking or per guest only; it has no per-hour unit. Adding one would be a new pricing feature, so these are shown as stated policies. An admin may add an AC service in Settings → Services if the venue wants it on bills, but a per-hour quantity is not supported.
  - **Advance non-refundable.** The card states no advance **amount or percentage**, so `pricing.advance` stays unset ("Not set"). There is no refund workflow and none was added. Admin payment voiding (for wrong entries) is unchanged.
  - **Taxes.** No rate is on the card, so none was added.
  - **Minimum 300 guests.** This is expressed through the surcharge, not as a hard booking limit. Setting `rules.minGuests = 300` would *refuse* smaller bookings, which contradicts the card's own surcharge for fewer guests.

## 3. Display-only policies

Shown as written; there is no software enforcement:

- outside catering / decoration;
- cleanliness and breakage;
- valuables;
- AC charge;
- fireworks and firing;
- extra time;
- extra services;
- taxes;
- non-refundable advance.

## 4. Where each policy is integrated

| Location | What | File |
|---|---|---|
| Single source | the full list | `src/data/policies.ts` |
| Public "Booking terms" sheet (home, gallery, inquiry form, footer) | the full list, as before | `src/data/menu.ts` re-exports it; `TermsSheet.tsx` unchanged |
| Online booking: review step, before "Send booking request" | "Venue terms (please read before sending)", collapsible | `src/components/booking/BookingRequestFlow.tsx` |
| Customer booking page | "Venue terms" section | `src/app/(account)/account/bookings/[bookingId]/page.tsx` |
| Quotation PDF | "Venue terms" section after "Policies". Copied into the quotation snapshot when a draft is generated, so new quotations carry it; older quotations stay exactly as issued | `src/lib/booking/finance.ts`, `finance-model.ts` (`terms?`), `documents-pdf.ts` |
| Admin → Settings → Policies | read-only "Official venue terms" panel above the existing editable Policies form | `src/app/(admin)/admin/settings/page.tsx` |
| Pricing | the surcharge and 5% (configuration defaults, now marked confirmed) | `src/lib/config/business-config.ts` |

**Not changed:**
- **Receipt PDFs.** Receipts are immutable snapshots of a payment; adding terms would change how existing receipts render.
- **The editable Cancellation / Refund / Modification policy texts** (Settings → Policies). The card does not give a cancellation or modification policy, so those fields stay for the venue to fill in. The non-refundable advance is already in the official terms.
- **Urdu PDF text.** The PDFs show the English terms. No Urdu font was added (the licensed-font limitation remains).

## 5. Wording that remains uncertain

- **Valuables:** the extraction says **"during Nikah"**; the existing transcription and the request say **"during the function / event"**. The stored text keeps "during the function" (supported by two sources). Please confirm.
- **Tax wording:** present on the card per the extraction, but **no rate**. It is stored as "All government taxes and regulations apply to the customer" (existing transcription).
- **Unreadable wording:** the extraction says some further handwritten or printed wording on the card is unclear. It was not added.

## 6. Business confirmation still required

1. **Cleanliness & breakage** (#3) comes from the user-supplied extraction only and is new to the site. Confirm it is on the card.
2. **Outside catering & decoration** (#2), **extra time Rs. 20,000 / hour** (#7) and **extra services charged separately** (#8) are in the existing transcription but not in the new extraction. Confirm they are still current.
3. "During Nikah" vs "during the function" (§5).
4. The advance **amount** (percent or fixed). It is not on the card and stays unset.
5. Whether AC / extra time should ever appear as bill lines. That needs an hours-based pricing unit, which is a feature decision.
6. Cancellation and modification policies. They are not on the card; the Settings fields stay empty.

## 7. Tests executed and results

All tests were run after the changes. The categories are kept separate:
- **in-memory:** the application logic on the in-memory transactional test store;
- **Auth emulator:** a real `next start` server, the memory store and real Auth-emulator sessions.

| Test | Category | Result |
|---|---|---|
| `npx tsc --noEmit` | static | **0 errors** |
| `npx eslint src tests` | static | **0 errors, 0 warnings** |
| `npm run test:booking` (pricing, booking, finance / quotation / PDF, config, rules, reviews, …) | in-memory | **204/204**: the previous 199 plus 5 new tests in `tests/booking/policies.test.ts` |
| New policy tests | in-memory | **5/5**. They cover: <br>• one terms source; <br>• the card values are the defaults, with no advance or base price invented; <br>• below 300 guests → Rs 300 per guest; <br>• 300 and above → no surcharge, while 5% still applies; <br>• new quotations carry the terms, and both quotation PDFs (with and without terms) render |
| Full E2E regression (`run-regress.mjs`) | Auth emulator | **all 20 harnesses pass in one run** (table below) |
| Policy integration probe (`pol-probe.mjs`) | Auth emulator | **4/4**. The terms appear on the customer booking page and in Admin → Settings → Policies; a customer still gets 404 on admin settings; the public home page renders |
| `npm run build` (clean `.next`, production env) | build | **exit 0**, 35/35 pages, 0 error / credential lines |

`npm run build` printed one warning, by design: `NEXT_PUBLIC_SITE_URL` is not set, because the domain is not confirmed (Phase 11).

**Full E2E regression results:**

| Harness | Result |
|---|---|
| portal-e2e | 89/89 |
| admin-panel-e2e | 68/68 |
| settings-e2e | 44/44 |
| finance-e2e | 56/56 |
| ops-e2e | 59/59 |
| comm-e2e | 49/49 |
| p10-e2e (SEO / reviews / gallery) | 54/54 |
| p11-security | 77/77 |
| p11-a11y (320–1280 px) | 32/32 |
| p11-perf | ran |
| booking-api-up | 21/21 |
| booking-ui (includes the booking review step) | 31/31 |
| admin-e2e | 9/9 |
| auth-e2e | 25/25 |
| reset-e2e | 26/26 |
| logout-check | ok |
| booking-api-down | 23/23 |
| portal-failure | 8/8 |
| admin-failure | 6/6 |
| inquiry-failure | 3/3 |

**Not executed:** the Firestore-emulator tests (`npm run test:rules`, `npm run test:booking:firestore`). The environment blocker on this machine is unchanged (Phase 11 §23), and these changes touch no Firestore rules or queries.

Not tested in a browser: the collapsible "Venue terms" in the booking review step specifically. It is client-rendered at step 3. The review step itself passes in booking-ui, and the component is the same one verified on the customer booking page.

## Changed files

**New**
- `src/data/policies.ts`
- `src/components/VenueTerms.tsx`
- `tests/booking/policies.test.ts`
- `SADIQ_PEARL_OFFICIAL_POLICIES.md`

**Modified**
- `src/data/menu.ts` (terms are now re-exported from `policies.ts`)
- `src/lib/config/business-config.ts` (comment only: values confirmed)
- `src/lib/booking/finance-model.ts`, `src/lib/booking/finance.ts` (quotation snapshot `terms`)
- `src/lib/booking/documents-pdf.ts` ("Venue terms" in the quotation PDF)
- `src/components/booking/BookingRequestFlow.tsx`
- `src/app/(account)/account/bookings/[bookingId]/page.tsx`
- `src/app/(admin)/admin/settings/page.tsx`

**Not changed**
- authentication, booking concurrency and availability;
- the payment architecture, receipts, event operations, notifications and reviews;
- Firestore rules and indexes.

No dependencies were added. Nothing was deployed.
