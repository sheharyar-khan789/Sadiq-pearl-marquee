// Browser-only Firebase initialisation. Server code must use ./admin instead.
// Cloud Storage is not used by any feature (storage.rules deny everything), so
// its SDK is not initialised or bundled (Phase 11).
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, firebaseEmulatorHost, isFirebaseConfigured, useFirebaseEmulators } from "./config";

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export class FirebaseNotConfiguredError extends Error {
  constructor() {
    super("Firebase web configuration is missing (NEXT_PUBLIC_FIREBASE_* environment variables).");
    this.name = "FirebaseNotConfiguredError";
  }
}

// Survives hot reloads during development so emulators are connected only once.
const globalForFirebase = globalThis as typeof globalThis & { __sadiqPearlFirebase?: FirebaseClient };

/** Lazily initialises (once) and returns the Firebase client services. */
export function getFirebase(): FirebaseClient {
  if (typeof window === "undefined") {
    throw new Error("The Firebase client SDK is browser-only. Use src/lib/firebase/admin.ts on the server.");
  }
  if (!isFirebaseConfigured) throw new FirebaseNotConfiguredError();
  if (globalForFirebase.__sadiqPearlFirebase) return globalForFirebase.__sadiqPearlFirebase;

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (useFirebaseEmulators) {
    connectAuthEmulator(auth, `http://${firebaseEmulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, firebaseEmulatorHost, 8080);
  }

  globalForFirebase.__sadiqPearlFirebase = { app, auth, db };
  return globalForFirebase.__sadiqPearlFirebase;
}
