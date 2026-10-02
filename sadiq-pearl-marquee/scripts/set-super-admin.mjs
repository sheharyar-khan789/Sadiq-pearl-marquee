#!/usr/bin/env node
// Grants or revokes the Super Admin role for an EXISTING Firebase account by
// setting a custom claim with the Admin SDK. This is the only way the role can
// be assigned: it is never read from client input or Firestore documents.
//
// Run locally by the venue owner/developer, with server credentials in .env.local:
//   node --env-file=.env.local scripts/set-super-admin.mjs <email>            # grant
//   node --env-file=.env.local scripts/set-super-admin.mjs <email> --revoke   # revoke
//
// The account must already exist and have a verified email address. Existing
// sessions are revoked, so the user must sign in again for the change to apply.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ROLE = "super_admin";
const [email, flag] = process.argv.slice(2);
const revoke = flag === "--revoke";

if (!email || !email.includes("@") || (flag && !revoke)) {
  console.error("Usage: node --env-file=.env.local scripts/set-super-admin.mjs <email> [--revoke]");
  process.exit(1);
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

let options;
if (projectId && clientEmail && privateKey) options = { credential: cert({ projectId, clientEmail, privateKey }), projectId };
else if (process.env.FIREBASE_AUTH_EMULATOR_HOST && projectId) options = { projectId };
else {
  console.error("Missing Firebase Admin credentials (FIREBASE_ADMIN_PROJECT_ID / _CLIENT_EMAIL / _PRIVATE_KEY).");
  process.exit(1);
}

const auth = getAuth(initializeApp(options));

try {
  const user = await auth.getUserByEmail(email);
  if (!revoke && !user.emailVerified) {
    console.error(`Refusing: ${email} has not verified its email address yet.`);
    process.exit(1);
  }
  const claims = { ...(user.customClaims ?? {}) };
  if (revoke) delete claims.role;
  else claims.role = ROLE;
  await auth.setCustomUserClaims(user.uid, claims);
  await auth.revokeRefreshTokens(user.uid); // force re-sign-in so sessions pick up the change
  console.log(`${revoke ? "Revoked" : "Granted"} ${ROLE} for ${email} (uid ${user.uid}). They must sign in again.`);
} catch (error) {
  console.error(`Failed: ${error.code ?? error.message}`);
  process.exit(1);
}
