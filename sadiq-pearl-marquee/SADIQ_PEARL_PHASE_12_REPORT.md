# Sadiq Pearl Marquee — Phase 12 Report
## Production Launch — BLOCKED

Date: 2026-10-02

## Executive summary

**Production status: BLOCKED.**

The required production values are missing, so the Phase 12 stop conditions apply. **Nothing was configured, deployed, created or changed in any Firebase project.** No values were invented.

**BLOCKED — REQUIRED PRODUCTION VALUE MISSING.**

## Evidence gathered (read-only checks)

| Check | Result |
|---|---|
| Production env file (`.env.local`, `.env.production`, `.env`) | **none**. Only `.env.example` (empty template) exists |
| Production env variables in the shell | **none** (`NEXT_PUBLIC_*`, `FIREBASE_*`, `GOOGLE_APPLICATION_CREDENTIALS` all unset) |
| Firebase project link (`.firebaserc`) | **none** |
| Firebase projects visible to the logged-in Firebase CLI account (`firebase projects:list`, read-only) | 7 projects, **none of them for Sadiq Pearl Marquee** (all belong to other apps) |
| Hosting / deployment configuration | **none**: no `hosting` in `firebase.json`, no `apphosting.yaml`, no Vercel / Netlify config, no CI workflow. Only a GitHub remote exists |
| Production domain (`NEXT_PUBLIC_SITE_URL`) | **not supplied**. The code still uses the placeholder (Phase 11, finding M1) |
| Business configuration | **not supplied** (see the list below) |

## Exact blockers

1. **Production Firebase project unavailable.** No Sadiq Pearl Firebase project exists in the CLI account, and none was named. Creating one would mean choosing an account, project ID, region and billing plan. That is the owner's decision; it was not done automatically.
2. **Production credentials unavailable.**
   - Firebase web config: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.
   - Admin credentials: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`, or the hosting's built-in credentials.
   - Note: the app uses Firebase session cookies, so it needs no separate session or JWT secret.
3. **Production domain unavailable.** `NEXT_PUBLIC_SITE_URL` is needed for canonical URLs, the sitemap, robots, Open Graph, Twitter and JSON-LD. The same domain must be added to Firebase Auth's authorized domains.
4. **No hosting architecture exists to deploy to.** The prompt says to use the existing architecture. There is none, so the owner must choose one; the code supports Firebase App Hosting / Cloud Run or any Node host running `next start`.
5. **Super Admin email not supplied.** Needed for `scripts/set-super-admin.mjs`.
6. **Business configuration not supplied.**
   - Already available: venue name, address, phones, WhatsApp number.
   - Missing:
     - hall capacity confirmation;
     - Day / Night slot times;
     - final event types, services, menus and packages;
     - prices: hall rent, per-person rate, service charge, surcharge;
     - advance rule;
     - cancellation, modification and refund policies;
     - quotation validity;
     - vendor records;
     - a licensed Urdu PDF font (optional; without it Urdu text prints as "?").
   - Without prices the system stays safely in **"Pricing pending"**. Bookings can still be requested and reviewed, but prices cannot be calculated. This is a supported state, not a blocker by itself.

## Phase 12 launch checklist (to run once the inputs above are supplied)

1. **Firebase project:** create or choose it. Enable Email/Password and Google sign-in. Create the Firestore database (choose a region). Enable Storage (all access stays denied).
2. **Local setup:** add `.firebaserc` with the project ID, and `.env.local` (never committed) or hosting secrets with the variables above, plus `NEXT_PUBLIC_SITE_URL`.
3. **Rules and indexes:** run the 82-test rules suite in CI or on a machine where the Firestore emulator starts. Then run `firebase deploy --only firestore:rules,firestore:indexes,storage`.
4. **Super Admin:** create the owner's account and verify its email. Run `node scripts/set-super-admin.mjs <email>`. Sign in again and confirm that `/admin` works and a customer gets 404.
5. **Build:** remove `.next`, then run `npm run build` with the production env. Expect exit 0 and **no** placeholder-domain warning.
6. **Deploy** to the chosen host. Add the domain to Firebase Auth's authorized domains. Check HTTPS and HSTS.
7. **Smoke tests:**
   - the public pages and SEO URLs (no placeholder);
   - the Phase 11 security harness pointed at production, read-only and non-destructive checks only;
   - customer and admin flows with one clearly-marked test account, cleaned up afterwards;
   - mobile widths.
8. **Business configuration:** the admin enters it in Settings, using real values only.
9. **Backups:** enable Firestore point-in-time recovery or scheduled exports. They are **not configured** today, because no project exists.

## Current verified state of the code (from Phase 11, unchanged)

- Build: success.
- Tests:
  - unit tests 199/199;
  - all 20 E2E harnesses pass, including security 77/77 and accessibility 32/32;
  - Storage rules 3/3 on the emulator.
- Firestore emulator tests: **NOT EXECUTED — ENVIRONMENT BLOCKER** (local Java loopback-selector failure).
- No Critical or High findings.

## Changes in Phase 12

- New file: `SADIQ_PEARL_PHASE_12_REPORT.md` (this report).
- Nothing else was changed. No deployment, no Firebase changes, no DNS changes, no commits.

## Final decision

**Not production-ready to launch: BLOCKED** on the missing production Firebase project, credentials, domain, hosting choice, Super Admin email and business configuration listed above.
