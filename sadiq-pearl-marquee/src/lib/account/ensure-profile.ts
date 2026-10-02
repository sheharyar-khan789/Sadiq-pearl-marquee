// Creates or refreshes the customer's users/{uid} profile on the server —
// SERVER ONLY. Identity comes from a verified ID token or session cookie,
// never from the request body.
import "server-only";
import type { DecodedIdToken } from "firebase-admin/auth";
import { logBookingError, profileStore, withTimeout } from "@/lib/booking/server";

/** Returns false (and logs the code) if the profile couldn't be saved. */
export async function ensureProfileFromToken(token: DecodedIdToken): Promise<boolean> {
  const profiles = profileStore();
  if (!profiles) return false;
  try {
    await withTimeout(
      profiles.ensure({
        uid: token.uid,
        email: token.email ?? null,
        emailVerified: token.email_verified === true,
        signInProvider: token.firebase?.sign_in_provider ?? null,
        name: typeof token.name === "string" ? token.name : null,
        photoURL: typeof token.picture === "string" ? token.picture : null,
      }),
      8_000
    );
    return true;
  } catch (error) {
    logBookingError("profile ensure", error);
    return false;
  }
}
