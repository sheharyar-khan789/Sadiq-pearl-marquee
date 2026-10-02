# Sadiq Pearl Marquee — Phase 2 Report (Firebase Foundation & Authentication)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Firebase client/Admin foundation, authentication (email/password + Google), email verification, `users/{uid}` profile, session-based route protection, Super Admin authorisation foundation, Firestore/Storage security rules, auth UI |
| Not in scope (not built) | Booking engine, availability/slots, booking requests, customer dashboard/history, admin dashboard, calendar, payments, receipts, quotations, vendors, menus/packages management, notifications, reports, CMS |
| Stack | Next.js 16.3.7 (App Router, `proxy`), React 19.3, TypeScript 5.9, `firebase` 12.19.0, `firebase-admin` 14.5.0 |

> **No real Firebase project exists yet.** No credentials were created, guessed or hardcoded. Everything was implemented against environment variables and tested with the **Firebase Emulator Suite** using a `demo-` project ID (offline, no cloud resources). The **Firestore and Storage emulators could not run on this machine** (see §10), so their rules were **not executed** here. A ready-to-run rules test suite is included for you to run.

---

## 1. What was implemented

- **Centralised Firebase client** (Auth, Firestore, Storage). It initialises once, is safe across hot reloads, and is configured only from `NEXT_PUBLIC_FIREBASE_*` variables. There's an optional emulator mode for local development.
- **Firebase Admin foundation, server-only.** It's guarded by `import "server-only"`, so the build fails if a client component imports it. Credentials come from server-only variables, Google Application Default Credentials, or the local emulator.
- **Session-based server authentication.** An ID token is exchanged for an httpOnly **session cookie** (`__session`, 5 days), verified on every protected request with signature, expiry and **revocation** checks.
- **Email/password:** sign-up, sign-in, sign-out, client validation, and friendly error messages.
- **Google:** "Continue with Google" (popup), with every failure mode handled.
- **Email verification:**
  - a verification email is sent on sign-up;
  - an unverified badge is shown;
  - **resend** has a 60-second cooldown;
  - **"I've verified — check again"** refreshes the token and the server session;
  - a custom **email-action page** (`/auth/action`) handles valid, expired, invalid and already-used links.
- **`users/{uid}` Firestore profile.** It's created idempotently after sign-in and **never contains passwords or roles**. Partial failures are reported with a retry, not hidden.
- **Route protection foundation.** A Next 16 `proxy` does an optimistic redirect for `/account/*` and `/admin/*`. The real check is server-side via `requireUser()` / `requireSuperAdmin()`.
- **Super Admin foundation.** The role is a **custom claim set only server-side**, by `scripts/set-super-admin.mjs`, which requires a verified email and revokes existing sessions when the role changes. There's no admin panel, per scope.
- **Security rules:** deny-by-default Firestore rules (owner-only `users/{uid}`) and fully closed Storage rules.
- **Auth UI** in the site's luxury style: `/login`, `/signup`, `/account` (status only, not a dashboard), `/auth/action`, plus a discreet **account link** in the existing header and mobile menu.
- **Graceful degradation.** With no Firebase configuration (today's state), the site builds and runs normally. The sign-in pages show a WhatsApp contact message instead of forms, and the session API returns `503 auth_unavailable`.

## 2. Firebase architecture

```
Browser (client components)                       Server (Next.js, Node runtime)
────────────────────────────                      ─────────────────────────────────────
lib/firebase/client.ts   getFirebase()             lib/firebase/admin.ts  (server-only)
  Auth · Firestore · Storage (emulator opt.)         adminAuth(): cert() | ADC | emulator
components/auth/AuthProvider.tsx                   app/api/auth/session/route.ts
  sign-in/up, Google, verify, sign-out ──ID token──▶  POST: verify ID token (revocation check),
  ensureUserProfile() → users/{uid}                   require recent sign-in or same-user session,
        │                                             createSessionCookie → Set-Cookie __session
        ▼ (rules-validated writes)                    DELETE: clear cookie (same-origin only)
Cloud Firestore  users/{uid}                       proxy.ts  /account/*, /admin/* → /login if no cookie
                                                   lib/auth/server.ts  (server-only)
                                                     getSessionUser() → verifySessionCookie(…, true)
                                                     requireUser(), requireSuperAdmin() (claim + verified)
```

**Design decisions**

- **Firebase SDK only on auth pages.** The public homepage and gallery load **no Firebase JavaScript** (verified in the built bundles), so Phase 1 performance is unchanged. The header account link is a plain link to `/account`.
- **The security boundary is on the server.** The `proxy` only checks that a cookie exists. Every protected page and future data access must call `requireUser()` or `requireSuperAdmin()`, which verify the cookie with the Admin SDK (revocation included). Hiding UI is never relied on.
- **Session cookie rather than client tokens.** It's httpOnly (JavaScript can't read it), `Secure` in production, `SameSite=Lax` and same-origin-only, and it's the one cookie name Firebase Hosting forwards.
- **Minimal dependencies:** `firebase` and `firebase-admin` only. The `server-only` guard is provided by Next 16 itself, and no state libraries were added.

## 3. Files created

| File | Purpose |
|---|---|
| `src/lib/firebase/config.ts` | Web config from `NEXT_PUBLIC_*` env; `isFirebaseConfigured`; emulator switch |
| `src/lib/firebase/client.ts` | Browser-only singleton init of Auth/Firestore/Storage |
| `src/lib/firebase/admin.ts` | **Server-only** Admin SDK init (service account / ADC / emulator) |
| `src/lib/auth/constants.ts` | Cookie name/lifetime, role constant, open-redirect-safe `safeNextPath()` |
| `src/lib/auth/server.ts` | **Server-only** `getSessionUser`, `requireUser`, `requireSuperAdmin` |
| `src/lib/auth/errors.ts` | Firebase error code → customer-friendly message (raw code logged) |
| `src/lib/auth/profile.ts` | `users/{uid}` schema + idempotent `ensureUserProfile()` |
| `src/app/api/auth/session/route.ts` | Session cookie issue (POST) / clear (DELETE) with CSRF origin check |
| `src/proxy.ts` | Optimistic protection for `/account/*`, `/admin/*` |
| `src/app/(auth)/layout.tsx` | Auth provider + split-screen frame; `noindex` |
| `src/app/(auth)/login/page.tsx`, `signup/page.tsx` | Sign-in / sign-up pages (signed-in users are redirected) |
| `src/app/(auth)/auth/action/page.tsx` | Custom email-verification link handler |
| `src/app/(account)/layout.tsx`, `account/page.tsx` | Protected account status page (server-verified) |
| `src/components/auth/AuthProvider.tsx` | Central auth state + actions (React context) |
| `src/components/auth/LoginForm.tsx`, `SignupForm.tsx`, `AccountPanel.tsx`, `EmailActionHandler.tsx`, `GoogleButton.tsx`, `NotConfigured.tsx`, `AuthFrame.tsx`, `fields.tsx` | Auth UI |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json` | Security rules + Firebase CLI/emulator config |
| `.env.example` | Environment variable template (no values) |
| `scripts/set-super-admin.mjs` | Grant/revoke the Super Admin custom claim (server credentials) |
| `scripts/test-security-rules.mjs` | 22 Firestore/Storage rules tests for the emulator |
| `SADIQ_PEARL_PHASE_2_REPORT.md` | This report |

## 4. Files modified

| File | Change |
|---|---|
| `package.json` / `package-lock.json` | Added `firebase` ^12.19.0 and `firebase-admin` ^14.5.0; added `test:rules` script |
| `src/components/Navbar.tsx` | Added an account icon link (desktop header) and a "Sign in / Your account" link (mobile menu). No other change |
| `src/components/Icon.tsx` | Added `user`, `eye`, `eyeOff`, `alert`, `logout` icons |
| `README.md` | "Customer accounts (Firebase)" section |

No other Phase 1 files, content, business data, WhatsApp number, address, prices or capacity were changed.

## 5. Environment variables required

Copy `.env.example` to `.env.local` (git-ignored) or set these in your hosting provider.

| Variable | Scope | Where to find it |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public (browser) | Console → Project settings → Your apps → Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | same |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | same |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | same |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | same |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | same |
| `FIREBASE_ADMIN_PROJECT_ID` | **Server-only, secret** | Service-account JSON `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **Server-only, secret** | Service-account JSON `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **Server-only, secret** | Service-account JSON `private_key` (one line with `\n`, in double quotes) |
| `NEXT_PUBLIC_FIREBASE_USE_EMULATORS`, `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | Local development only | Leave unset in production |

- The web config values are public by design; Security Rules protect the data.
- The Admin values are secrets and must never use `NEXT_PUBLIC_`.
- On Firebase App Hosting / Cloud Run the Admin variables aren't needed, because Application Default Credentials are used.
- `NEXT_PUBLIC_*` values are inlined at **build** time, so rebuild after changing them.

## 6. Authentication flows

| Flow | Behaviour |
|---|---|
| **Sign-up (email)** | Validate (name 2–100 chars, email, password ≥ 8) → create Auth user → set display name → **send verification email** → create profile and start the server session **in parallel** → `/account`. Any partial failure (profile, verification email, session) is shown with a clear next step; nothing is silently "successful". |
| **Sign-in (email)** | Validate → `signInWithEmailAndPassword` → profile sync + session → redirect to a **same-site** `next` path only (external `?next=` is ignored). |
| **Google** | Popup with account chooser → profile + session → `/account`. Closed, blocked or cancelled popups, a different sign-in method for the same email, and unauthorised domains each get a friendly message. |
| **Sign-out** | Session cookie cleared server-side (same-origin DELETE) → Firebase sign-out → `/login`. |
| **Verification** | Unverified badge on `/account`; **resend** (60 s cooldown; Firebase rate limits mapped to messages); **check again** reloads the user, refreshes the token and re-issues the session. `/auth/action` handles valid, invalid, expired and already-used links. Users are **never marked verified** except from Firebase's own token. |
| **Persistence** | Firebase keeps the browser session (IndexedDB); the server session is 5 days. Refresh and new tabs stay signed in. |
| **Already signed in** | `/login` and `/signup` redirect to `/account`. |

## 7. Firestore structure

`users/{uid}` (document ID = Firebase Auth UID)

| Field | Type | Notes |
|---|---|---|
| `uid` | string | Must equal the document ID and the signed-in UID |
| `email` | string | Must equal the email in the user's verified token |
| `name` | string? | From sign-up or Google (≤ 100 chars); omitted if unknown |
| `photoURL` | string? | Google photo URL if provided (≤ 2048 chars) |
| `authProvider` | `"password"` \| `"google.com"` | Must match the token's sign-in provider |
| `emailVerified` | boolean | Mirror only; rules accept **only** the value in the user's token |
| `createdAt`, `updatedAt` | timestamp | Must be server time (`request.time`) |

- **Deliberately not stored yet:** phone, address, CNIC. They belong to the profile-editing phase, and no data is invented.
- **Never stored:** passwords, tokens, roles.
- **No other collections were created.** Bookings, payments and the rest belong to later phases.

## 8. Security rules summary

**Firestore (`firestore.rules`)**
- **Deny by default.** Only `users/{uid}` is matched; every other path (bookings, settings, …) is closed.
- **`get`:** the owner only, plus a read-only Super Admin (custom claim `role == "super_admin"` and a verified email).
- **`list`:** denied (future admin listing will use the Admin SDK on the server).
- **`create`:** owner only, with:
  - a **whitelist of fields** (no `role`, `admin` or password fields possible);
  - required fields present;
  - `uid`, `email` and `authProvider` bound to the verified token;
  - `emailVerified` equal to the token's value;
  - server timestamps.
- **`update`:** owner only. Only `name`, `photoURL`, `emailVerified` (token-bound) and `updatedAt` may change; `uid`, `email`, `authProvider` and `createdAt` are immutable.
- **`delete`:** denied (account deletion will be server-side later).
- **Pending by design:** rules for future collections are written in the phase that introduces them.

**Storage (`storage.rules`):** fully closed. No reads or writes for anonymous or signed-in users, because no upload feature exists yet. Profile photos and media management will add narrowly scoped rules (owner, content type, size) later.

## 9. Admin authorisation foundation

**Identity → server verification → role check.**

- **Identity** is Firebase Auth; there are no shared passwords and no admin credentials in code.
- **Role assignment** uses the custom claim `role: "super_admin"`, set **only** by `node --env-file=.env.local scripts/set-super-admin.mjs <email> [--revoke]`, which needs server Admin credentials.
  - The script **refuses unverified accounts**.
  - It **revokes existing sessions**, so the change takes effect at the next sign-in.
- **Enforcement:** `requireSuperAdmin()` verifies the session cookie server-side and requires the claim **and** a verified email. Non-admins get a 404, so the admin area isn't revealed. Firestore rules read the same claim.
- **Client-provided role values are never trusted.** The client can't set claims: this was tested and rejected with `INSUFFICIENT_PERMISSION`. Firestore rules reject any `role` field, and the browser never decides authorisation.
- **No `/admin` pages exist** (per scope). `/admin/*` is already covered by the proxy and ready for the guarded layout of the admin phase.

## 10. Tests performed & results

### Environment note — why Firestore/Storage rules were not executed here
- The Firestore and Storage emulators are Java programs.
- Even a minimal `Selector.open()` fails on this machine inside this agent environment (`Unable to establish loopback connection`), because Windows refuses the AF_UNIX loopback socket Java needs. Java's plain TCP loopback works.
- An attempt to patch around this in the JDK was **blocked by the tool-safety policy and abandoned**. The machine's Java installation was not modified.
- The **Auth emulator** (Node-based) worked, so every authentication flow was tested end to end.
- **Firestore/Storage rules must be run once on your machine:** `npm run test:rules`, with the Firebase CLI + Java 21 installed.

### Static checks
| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | ✅ exit 0 |
| ESLint (`npm run lint`) | ✅ exit 0: 0 errors, 1 pre-existing warning (`postcss.config.mjs`) |
| Production build (no Firebase env, i.e. today's state) | ✅ exit 0; `/`, `/gallery`, `robots`, `sitemap` still static; auth routes dynamic; proxy active |
| Emulator-wired test build | ✅ exit 0 |
| `npm audit` | ⚠ 2 **moderate** advisories in `uuid < 11.1.1` via `gaxios` (inside `firebase-admin`'s Google auth libraries). The non-breaking `npm audit fix` can't resolve them; see §12 |

### Authentication end-to-end (headless Chrome + Auth emulator): **25/25 passed**
The full run passed 21/21 non-Google checks. Its Google check initially failed because of the *test harness*: it used a scripted click, which Chrome blocks as a non-user gesture, and it detected the popup incorrectly. After fixing the harness (no app code changed), a follow-up run passed all 4 Google checks.
- Signed-out `/account` redirects to `/login?next=%2Faccount`.
- Sign-up validation messages (name, email, password length).
- Sign-up creates the account and opens `/account`, showing the name and **"Not verified yet"**.
- The session cookie is **httpOnly, SameSite=Lax, Secure**, and no token is readable by JavaScript.
- A verification email is issued on sign-up. Resend issues another, and the cooldown shows.
- "Check again" while unverified reports it honestly.
- An invalid verification link shows a clear error. A valid link verifies, and the account then shows **Verified**.
- The session persists across reload.
- Sign-out clears the cookie and `/account` is protected again.
- A wrong password shows "email or password is incorrect". An existing email on sign-up shows "already exists".
- Sign-in works, and an **external `?next=` is ignored** (no open redirect).
- A signed-in user visiting `/login` is sent to `/account`.
- **Google:** the popup opens; sign-in via the emulator's Google provider completes; the account shows "Google" and "Verified"; closing the popup shows a friendly message.

### Server / API hardening: **all passed**
| Case | Result |
|---|---|
| Session API without `Origin` / with a foreign `Origin` | 403 / 403 |
| Forged unsigned ID token | 401 `invalid_token` |
| Malformed body | 400 |
| `/account`, `/admin/x` without a cookie | 307 → `/login?next=…` |
| `/account` with a **forged cookie** | Passes the proxy, then **rejected by server verification** → 307 login |
| Session API with no Admin credentials | 503 `auth_unavailable` (no crash) |

### Super Admin foundation (Auth emulator): **9/9 passed**
- Grant refused for an unverified account.
- Customer self-assignment of the role through the client API → `INSUFFICIENT_PERMISSION`.
- A customer session carries no role claim.
- Grant succeeds for a verified account, and the **existing session is revoked**.
- The new session carries the server-set `role: "super_admin"`.
- Revoke removes the role and ends sessions.

### Firestore & Storage rules
- **Not executed in this environment** (see the note above).
- `scripts/test-security-rules.mjs` contains **22 cases**:
  - own profile create/read/update allowed;
  - another user's profile and signed-out access denied;
  - `role` injection, forged `emailVerified`, email/immutable-field changes, listing, deleting and unmatched collections denied;
  - Storage upload/read denied for signed-out and signed-in users.
- The rules were reviewed manually against each case.
- In the browser end-to-end runs the Firestore backend was unreachable. The app **correctly reported** "Your account works, but we couldn't finish saving your profile" with a retry, instead of pretending success. This exercises the partial-failure path.

### Security review: **all clean**
- No Admin SDK code, private keys or session/claims functions in any browser bundle (`.next/static` scanned).
- `firebase-admin` is imported only by `lib/firebase/admin.ts` and `lib/auth/server.ts`, both `server-only`, and **no client component imports them**.
- Only web-config and emulator switches use `NEXT_PUBLIC_`.
- `.env.local`, `service-account*.json`, `*firebase-adminsdk*.json` and `*.pem` are confirmed git-ignored; only `.env.example` is added.
- No passwords, tokens or roles in Firestore data.
- **Homepage scripts contain no Firebase SDK** (checked all 10).

### Browser / regression QA
- `/login` and `/signup` at **320, 375, 390, 430, 768, 1024, 1440 px**: no horizontal overflow, no broken images, **no console errors**.
- `/account` (390, 1440): no overflow and no errors.
- Home (375, 1440): hero film plays, gallery OK, no errors.
- `/gallery` (390): OK.
- The WhatsApp CTAs and mobile menu are unchanged. The only header change is the account link.
- No hydration errors appeared in any run.
- Visual check: the auth screens use the Phase 1 design language (Cormorant headings, espresso/champagne buttons, venue photography on desktop).

## 11. Manual Firebase Console steps (NOT done; they need your Google account)

1. **Create a project** at <https://console.firebase.google.com> (e.g. "Sadiq Pearl Marquee"). Google Analytics is optional. Consider a separate dev project.
2. **Register a Web App** (Project settings → General → Add app → Web). Copy its config into `.env.local` as the six `NEXT_PUBLIC_FIREBASE_*` variables.
3. **Authentication → Sign-in method:**
   - enable **Email/Password** (leave "Email link" off);
   - enable **Google**, then set the project support email and public-facing name ("Sadiq Pearl Marquee").
4. **Authentication → Settings → Authorized domains:** add your production domain (still unresolved, see §13) and any preview/hosting domains. `localhost` is present by default.
5. **Authentication → Templates → Email address verification** (recommended):
   - set the sender name;
   - click **Customize action URL** and enter `https://<your-domain>/auth/action` so verification links open the site's own branded page.

   Until this is done, Firebase's default page handles the links, which also works.
6. **Firestore Database → Create database** in production mode. Choose a region near Pakistan, for example `asia-south1` (Mumbai) or `me-central1` (Doha). **The region can't be changed later.**
7. **Storage → Get started** (requires the Blaze pay-as-you-go plan for new buckets) in the same region.
8. **Deploy the rules** from the project folder:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add
   firebase deploy --only firestore:rules,storage
   ```
   `firebase use --add` selects your project and creates a local `.firebaserc`.
9. **Admin credentials** (only if not hosting on Firebase App Hosting / Cloud Run):
   - Project settings → Service accounts → **Generate new private key**;
   - copy `project_id`, `client_email` and `private_key` into `.env.local` as `FIREBASE_ADMIN_*`, and set them as **secret** environment variables in your host;
   - **delete the downloaded JSON file.**
10. **Grant the Super Admin role** to the owner's account after it has signed up and verified its email:
    ```
    node --env-file=.env.local scripts/set-super-admin.mjs <owner-email>
    ```
11. **Run the rules tests once:** `npm run test:rules` (Firebase CLI + Java 21).
12. **Recommended:** enable App Check (reCAPTCHA Enterprise) and set up budget alerts.

## 12. Remaining issues

- **Firestore/Storage rules not executed here** (environment limitation). Run `npm run test:rules` once.
- **`npm audit`: 2 moderate advisories (`uuid < 11.1.1` via `gaxios`)** in `firebase-admin`'s Google libraries. The affected functions (v3/v5/v6 with a caller buffer) aren't used on that path. Fixing now would need a forced major-version override inside Google's auth library, which risks breaking Firebase Admin. **Recommendation:** accept for now and re-check when `firebase-admin` updates.
- npm 11 skipped install scripts for `@firebase/util`, `protobufjs` and `unrs-resolver` (its new `allowScripts` policy). Nothing here relies on them, and the builds and tests pass.
- There's **no rate limiting** on `/api/auth/session` beyond Firebase's own. Consider App Check or host-level rate limiting before launch.
- **Password reset** ("Forgot password?") wasn't in the required flows, so it isn't built. Without it, email/password customers who forget their password can't recover it. This is a small addition; see §13.
- The production domain is still unresolved (from earlier phases), which affects authorised domains and the email action URL.

## 13. Decisions needing your approval

1. **Password reset flow:** add it in the next phase? Recommended.
2. **Privacy policy / terms for accounts:** collecting customer accounts, and later CNIC/phone/address, should have a published privacy notice. Content must come from you.
3. **Super Admin email(s):** which Google/email account(s) should hold the role?
4. **Hosting target:** Firebase App Hosting (no Admin keys needed) or Vercel/other (needs `FIREBASE_ADMIN_*` secrets). Also the **region** for Firestore/Storage.
5. **`npm audit` moderate `uuid` advisory:** accept for now (recommended) or force an override?
6. **Separate dev and production Firebase projects** (recommended), or one?
7. **Whether unverified email users should be blocked** from future booking actions (recommended: require verification before booking).

## 14. Exact next-phase prerequisites

- [ ] The console steps in §11 completed (project, web app, Email/Password + Google, authorised domains, Firestore, Storage, rules deployed).
- [ ] `.env.local` (development) and host environment (production) filled with real values; `NEXT_PUBLIC_*` values present at build time.
- [ ] `npm run test:rules` run successfully on a machine with Java 21, or rules verified in the console Rules Playground.
- [ ] A real sign-up and Google sign-in performed on the real project, with a verification email received from a real inbox.
- [ ] The Super Admin granted to the owner's verified account.
- [ ] The production domain confirmed and added to authorised domains; the email action URL set.
- [ ] Decisions in §13 answered, especially password reset, privacy policy, hosting/region and verified-only booking.
- [ ] Business inputs still needed for booking: slot names/times (Day/Night), hall name and capacity, pricing and services.
