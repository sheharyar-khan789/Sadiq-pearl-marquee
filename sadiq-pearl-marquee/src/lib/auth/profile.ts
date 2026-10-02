// Firestore customer profile: users/{uid}. Browser-side; every write is
// validated by firestore.rules (owner only, fixed field set, no role field).
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";

/** Shape of users/{uid}. Passwords and roles are never stored here. */
export interface UserProfileDoc {
  uid: string;
  email: string;
  name?: string;
  photoURL?: string;
  authProvider: "password" | "google.com";
  /** Mirror of the Auth record; rules only accept the value in the user's token. */
  emailVerified: boolean;
  createdAt: unknown;
  updatedAt: unknown;
}

/**
 * Creates the profile if it doesn't exist yet, and keeps `emailVerified` in
 * step with Firebase Auth. Safe to call repeatedly (e.g. on every sign-in),
 * which also repairs an earlier partial failure.
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const { db } = getFirebase();
  const ref = doc(db, "users", user.uid);
  const tokenResult = await user.getIdTokenResult();
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    if (!user.email) throw Object.assign(new Error("Account has no email address"), { code: "profile/no-email" });
    const provider = tokenResult.signInProvider === "google.com" ? "google.com" : "password";
    const profile: Record<string, unknown> = {
      uid: user.uid,
      email: user.email,
      authProvider: provider,
      emailVerified: tokenResult.claims.email_verified === true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const name = user.displayName?.trim();
    if (name) profile.name = name.slice(0, 100);
    if (user.photoURL?.startsWith("https://") && user.photoURL.length <= 2048) profile.photoURL = user.photoURL;
    await setDoc(ref, profile);
    return;
  }

  const verified = tokenResult.claims.email_verified === true;
  if (snapshot.data().emailVerified !== verified) {
    await updateDoc(ref, { emailVerified: verified, updatedAt: serverTimestamp() });
  }
}
