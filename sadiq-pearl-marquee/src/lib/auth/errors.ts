// Maps Firebase error codes to messages customers can act on. The raw code is
// logged for debugging but never shown verbatim.

export type AuthNotice = { tone: "error" | "info"; message: string };

const messages: Record<string, AuthNotice> = {
  "auth/invalid-email": { tone: "error", message: "Please enter a valid email address." },
  "auth/missing-email": { tone: "error", message: "Please enter your email address." },
  "auth/missing-password": { tone: "error", message: "Please enter your password." },
  "auth/weak-password": { tone: "error", message: "Please choose a stronger password (at least 8 characters)." },
  "auth/email-already-in-use": {
    tone: "error",
    message: "An account already exists with this email. Please sign in instead.",
  },
  "auth/invalid-credential": { tone: "error", message: "The email or password is incorrect." },
  "auth/invalid-login-credentials": { tone: "error", message: "The email or password is incorrect." },
  "auth/wrong-password": { tone: "error", message: "The email or password is incorrect." },
  "auth/user-not-found": { tone: "error", message: "The email or password is incorrect." },
  "auth/user-disabled": { tone: "error", message: "This account has been disabled. Please contact the venue." },
  "auth/too-many-requests": {
    tone: "error",
    message: "Too many attempts. Please wait a few minutes and try again.",
  },
  "auth/network-request-failed": {
    tone: "error",
    message: "We couldn't reach the server. Check your internet connection and try again.",
  },
  "auth/popup-closed-by-user": { tone: "info", message: "Google sign-in was closed before it finished." },
  "auth/cancelled-popup-request": { tone: "info", message: "Google sign-in was cancelled." },
  "auth/user-cancelled": { tone: "info", message: "Google sign-in was cancelled." },
  "auth/popup-blocked": {
    tone: "error",
    message: "Your browser blocked the Google sign-in window. Please allow pop-ups for this site and try again.",
  },
  "auth/account-exists-with-different-credential": {
    tone: "error",
    message: "This email is already registered with a different sign-in method. Please sign in with your email and password.",
  },
  "auth/operation-not-allowed": {
    tone: "error",
    message: "This sign-in method isn't available yet. Please try another option.",
  },
  "auth/unauthorized-domain": {
    tone: "error",
    message: "Google sign-in isn't set up for this website address yet. Please use email and password.",
  },
  "auth/requires-recent-login": { tone: "error", message: "Please sign in again to continue." },
  "auth/expired-action-code": {
    tone: "error",
    message: "This link has expired. Please request a new one.",
  },
  "auth/invalid-action-code": {
    tone: "error",
    message: "This link is invalid or has already been used. Please request a new one.",
  },
  "auth/password-does-not-meet-requirements": {
    tone: "error",
    message: "This password doesn't meet the requirements. Please choose a stronger password.",
  },
  "auth/internal-error": {
    tone: "error",
    message: "Sign-in couldn't be completed. Please try again in a moment.",
  },
  "auth/web-storage-unsupported": {
    tone: "error",
    message: "Your browser is blocking the storage sign-in needs. Please enable cookies for this site and try again.",
  },
  "auth/quota-exceeded": {
    tone: "error",
    message: "We can't send more emails right now. Please try again later.",
  },
  // Our own codes (session API, profile setup, configuration)
  "session/failed": {
    tone: "error",
    message: "Your account is fine, but we couldn't start your secure session. Please sign in again.",
  },
  "session/unavailable": {
    tone: "error",
    message: "Online accounts aren't available right now. Please contact us on WhatsApp.",
  },
  "profile/failed": {
    tone: "error",
    message: "We couldn't complete your account setup. Please try again.",
  },
  "admin/not-admin": {
    tone: "error",
    message: "This account doesn't have admin access. Customers can sign in from the main website.",
  },
  "reset/send-failed": {
    tone: "error",
    message: "We couldn't send the reset email right now. Please try again in a moment.",
  },
  "verification/send-failed": {
    tone: "error",
    message: "We couldn't send the verification email. Please try again in a moment.",
  },
};

const fallback: AuthNotice = { tone: "error", message: "Something went wrong. Please try again." };

export function authErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return "unknown";
}

/**
 * Friendly message for an error; logs only the error code for debugging.
 * The error object itself is never logged: Firebase attaches token responses
 * to some auth errors (customData._tokenResponse), and action links carry
 * one-time codes, neither of which may reach the console.
 */
export function describeAuthError(error: unknown, context: string): AuthNotice {
  const code = authErrorCode(error);
  console.error(`[auth] ${context} failed: ${code}`);
  return messages[code] ?? fallback;
}

/** Message for a code; unknown codes use `fallbackCode`'s message, then a generic one. */
export function noticeFor(code: string, fallbackCode?: string): AuthNotice {
  return messages[code] ?? (fallbackCode ? messages[fallbackCode] : undefined) ?? fallback;
}
