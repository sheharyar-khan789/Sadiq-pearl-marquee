// Firebase Admin SDK — SERVER ONLY. `server-only` makes the build fail if this
// module is ever imported into a Client Component.
import "server-only";
import { applicationDefault, cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APP_NAME = "sadiq-pearl-admin";

/**
 * How the Admin SDK authenticates, in order of preference:
 *  1. Service account from server-only env vars (FIREBASE_ADMIN_*).
 *  2. Google Application Default Credentials (Firebase App Hosting / Cloud Run,
 *     or GOOGLE_APPLICATION_CREDENTIALS pointing to a key file outside the repo).
 *  3. Local emulators (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST) — development/testing only.
 */
function resolveAdminOptions() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  // Env files store the key with literal "\n" sequences; restore real newlines.
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return { credential: cert({ projectId, clientEmail, privateKey }), projectId };
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG || process.env.K_SERVICE) {
    return { credential: applicationDefault(), projectId };
  }
  if ((process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) && projectId) {
    return { projectId };
  }
  return null;
}

/** True when server-side verification (session cookies, ID tokens, claims) can run. */
export function isAdminConfigured(): boolean {
  return resolveAdminOptions() !== null;
}

export class AdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase Admin is not configured. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY (server-only)."
    );
    this.name = "AdminNotConfiguredError";
  }
}

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return getApp(APP_NAME);
  const options = resolveAdminOptions();
  if (!options) throw new AdminNotConfiguredError();
  return initializeApp(options, APP_NAME);
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Server-side Firestore (bypasses Security Rules — only for trusted server code). */
export function adminFirestore(): Firestore {
  return getFirestore(getAdminApp());
}
