# Sadiq Pearl Marquee — Phase 2.1 Report (Password Reset & Security Hardening)

| | |
|---|---|
| Date | 2026-09-30 |
| Scope | Forgot / reset password, security-rules test execution, focused auth/security review and fixes |
| Note | This report was written **at the start of Phase 3**. The Phase 2.1 session ended (it was interrupted for a project download) before the report existed. The results below are from the Phase 2.1 runs, plus re-runs done during Phase 3 (marked "re-run"). |

## 1. Implemented

- **Forgot password** (`/forgot-password`, linked as "Forgot password?" from sign-in):
  - Firebase `sendPasswordResetEmail` sends the email.
  - The success message is always neutral ("If an account with a password exists…"), so the page never reveals which emails have accounts.
  - People who signed up with Google are told they have no password with us and should use Continue with Google.
  - A 60-second resend cooldown applies.
- **Reset page** (`/auth/action?mode=resetPassword`):
  - It verifies the one-time code, shows which account is being reset, and removes the code from the address bar.
  - It asks for a new password and a confirmation (at least 8 characters, must match).
  - Expired, invalid and already-used links fail gracefully and offer "Request a new reset link".
  - After a successful reset, the session ends and the page links back to sign in.
- **Sign-out ends the session everywhere:** `DELETE /api/auth/session` now revokes the account's refresh tokens, so a copied session cookie stops working too.
- **No tokens in logs:** auth errors log only the Firebase error code, never the error object, which can carry token data.
- **Sign-in no longer hangs on Firestore:** it waits at most 8 s for the profile write.
- **`photoURL` must be `https://`**, enforced by both the Firestore rules and the client code.

## 2. Tests

| Test | Command / harness | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | PASS (exit 0) |
| ESLint | `npm run lint` | PASS: 0 errors, 1 pre-existing warning (`postcss.config.mjs`) |
| Storage rules | `firebase emulators:exec --only storage … --only=storage` | **PASS 3/3** (re-run in Phase 3: 3/3) |
| Firestore rules | `npm run test:rules` | **NOT EXECUTED — ENVIRONMENT BLOCKER.** The Firestore emulator (Java) cannot open its loopback socket on this machine ("Unable to establish loopback connection"). It fails with JDK 17, JBR 21 and JDK 25. |
| Password reset E2E (headless Chrome + Auth emulator) | `reset-e2e.mjs` | 25/26 (re-run in Phase 3: 25/26). See the one failure below. |
| Sign-out revocation, focused | `logout-check.mjs` | PASS 3/3 (copied cookie rejected after sign-out) |
| Auth E2E | `auth-e2e.mjs` | Re-run in Phase 3: **25/25**, including Google sign-in, after two waiting races in the test harness were fixed (see the Phase 3 report). |
| Super Admin foundation | `admin-e2e.mjs` | PASS 9/9 |

**The one failure, "copied session cookie rejected after sign-out" inside `reset-e2e`, is a Firebase precision limit, not a bug.**
- Firebase records a revocation to the whole second.
- In this test the new session is created in the same second as the reset's own revocation, and then signed out in that second too.
- The isolated `logout-check.mjs` (3 runs, including zero gap) rejects the copied cookie every time.

## 3. Known limitations

- The Firestore rules tests must be run on a machine where the Firestore emulator starts (Java 21+ and the Firebase CLI): `npm run test:rules`.
- `npm audit`: 2 moderate `uuid` advisories come in through `firebase-admin` → `gaxios`. They are not forced; a major upgrade would be needed.
