"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { syncProfileOnServer } from "@/lib/auth/profile";
import { authErrorCode, describeAuthError, noticeFor, type AuthNotice } from "@/lib/auth/errors";

export type AuthResult = { ok: true; notice?: AuthNotice } | { ok: false; notice: AuthNotice };
export type ProfileStatus = "idle" | "ready" | "error";

interface AuthContextValue {
  /** False when NEXT_PUBLIC_FIREBASE_* configuration is missing. */
  configured: boolean;
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  emailVerified: boolean;
  profileStatus: ProfileStatus;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resendVerification: () => Promise<AuthResult>;
  refreshVerification: () => Promise<AuthResult & { verified?: boolean }>;
  retryProfile: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Exchanges the user's ID token for the server's httpOnly session cookie. The
 * server also creates/refreshes the customer profile; returns whether it did.
 */
async function startServerSession(user: User): Promise<{ profileOk: boolean }> {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Session request failed (${response.status})`), {
      code: response.status === 503 ? "session/unavailable" : "session/failed",
    });
  }
  const data = (await response.json().catch(() => ({}))) as { profileOk?: boolean };
  return { profileOk: data.profileOk !== false };
}

function verificationSettings() {
  return { url: `${window.location.origin}/account`, handleCodeInApp: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [emailVerified, setEmailVerified] = useState(false);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  // One profile sync at a time per user (sign-up and the auth listener can race).
  const profileSync = useRef<Map<string, Promise<boolean>>>(new Map());
  // While an explicit sign-in/sign-up flow runs, it (not the listener) syncs the
  // profile, so e.g. the sign-up name is saved before the profile is created.
  const flowActive = useRef(false);

  const syncProfile = useCallback(async (u: User): Promise<boolean> => {
    let pending = profileSync.current.get(u.uid);
    if (!pending) {
      pending = syncProfileOnServer().finally(() => profileSync.current.delete(u.uid));
      profileSync.current.set(u.uid, pending);
    }
    try {
      // false: no server session yet (e.g. only the browser is signed in).
      setProfileStatus((await pending) ? "ready" : "idle");
      return true;
    } catch (error) {
      describeAuthError(error, "profile sync");
      setProfileStatus("error");
      return false;
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setEmailVerified(u?.emailVerified ?? false);
      setLoading(false);
      if (!u) setProfileStatus("idle");
      else if (!flowActive.current) void syncProfile(u);
    });
  }, [syncProfile]);

  /** Shared tail of every successful sign-in: server session (+ server-side profile). */
  const finishSignIn = useCallback(async (u: User): Promise<AuthResult> => {
    try {
      const { profileOk } = await startServerSession(u);
      setProfileStatus(profileOk ? "ready" : "error");
      return profileOk ? { ok: true } : { ok: true, notice: noticeFor("profile/failed") };
    } catch (error) {
      return { ok: false, notice: describeAuthError(error, "session start") };
    }
  }, []);

  /** Marks an explicit auth flow as running for its whole duration. */
  const inFlow = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    flowActive.current = true;
    try {
      return await run();
    } finally {
      flowActive.current = false;
    }
  }, []);

  const signIn = useCallback(
    (email: string, password: string): Promise<AuthResult> =>
      inFlow(async () => {
        try {
          const { auth } = getFirebase();
          const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
          return finishSignIn(cred.user);
        } catch (error) {
          return { ok: false, notice: describeAuthError(error, "email sign-in") };
        }
      }),
    [finishSignIn, inFlow]
  );

  const signUp = useCallback(
    (name: string, email: string, password: string): Promise<AuthResult> =>
      inFlow(async () => {
        let created: User;
        try {
          const { auth } = getFirebase();
          created = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
        } catch (error) {
          return { ok: false, notice: describeAuthError(error, "sign-up") };
        }

        // The account now exists; report (don't hide) any later partial failure.
        let verificationNotice: AuthNotice | undefined;
        try {
          if (name.trim()) {
            await updateProfile(created, { displayName: name.trim().slice(0, 100) });
            await created.getIdToken(true); // the token the server reads now carries the name
          }
        } catch (error) {
          describeAuthError(error, "display name update");
        }
        try {
          await sendEmailVerification(created, verificationSettings());
        } catch (error) {
          describeAuthError(error, "verification email");
          verificationNotice = noticeFor("verification/send-failed");
        }
        const result = await finishSignIn(created);
        if (!result.ok) return result;
        return { ok: true, notice: result.notice ?? verificationNotice };
      }),
    [finishSignIn, inFlow]
  );

  const signInWithGoogle = useCallback(
    (): Promise<AuthResult> =>
      inFlow(async () => {
        try {
          const { auth } = getFirebase();
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          const cred = await signInWithPopup(auth, provider);
          return finishSignIn(cred.user);
        } catch (error) {
          return { ok: false, notice: describeAuthError(error, "Google sign-in") };
        }
      }),
    [finishSignIn, inFlow]
  );

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    } catch (error) {
      describeAuthError(error, "session end");
    }
    if (isFirebaseConfigured) await firebaseSignOut(getFirebase().auth);
  }, []);

  const resendVerification = useCallback(async (): Promise<AuthResult> => {
    const current = isFirebaseConfigured ? getFirebase().auth.currentUser : null;
    if (!current) return { ok: false, notice: noticeFor("auth/requires-recent-login") };
    try {
      await sendEmailVerification(current, verificationSettings());
      return { ok: true };
    } catch (error) {
      return { ok: false, notice: describeAuthError(error, "resend verification") };
    }
  }, []);

  const refreshVerification = useCallback(async () => {
    const current = isFirebaseConfigured ? getFirebase().auth.currentUser : null;
    if (!current) return { ok: false as const, notice: noticeFor("auth/requires-recent-login") };
    try {
      await current.reload();
      await current.getIdToken(true); // fresh token carries the new email_verified claim
      setEmailVerified(current.emailVerified);
      // Server session (and the profile's emailVerified) now reflect verification.
      const { profileOk } = await startServerSession(current);
      setProfileStatus(profileOk ? "ready" : "error");
      return { ok: true as const, verified: current.emailVerified };
    } catch (error) {
      return { ok: false as const, notice: describeAuthError(error, "verification refresh") };
    }
  }, []);

  /**
   * Asks Firebase to email a password-reset link. Firebase creates, sends and
   * validates the one-time code; nothing is stored by this app. "No such user"
   * is reported as success so the form cannot reveal which emails have accounts.
   */
  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!isFirebaseConfigured) return { ok: false, notice: noticeFor("session/unavailable") };
    try {
      await sendPasswordResetEmail(getFirebase().auth, email.trim(), {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      return { ok: true };
    } catch (error) {
      const code = authErrorCode(error);
      if (code === "auth/user-not-found") return { ok: true };
      describeAuthError(error, "password reset request");
      return { ok: false, notice: noticeFor(code, "reset/send-failed") };
    }
  }, []);

  const retryProfile = useCallback(async (): Promise<AuthResult> => {
    const current = isFirebaseConfigured ? getFirebase().auth.currentUser : null;
    if (!current) return { ok: false, notice: noticeFor("auth/requires-recent-login") };
    return (await syncProfile(current)) ? { ok: true } : { ok: false, notice: noticeFor("profile/failed") };
  }, [syncProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isFirebaseConfigured,
      user,
      loading,
      authenticated: user !== null,
      emailVerified,
      profileStatus,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resendVerification,
      refreshVerification,
      retryProfile,
      requestPasswordReset,
    }),
    [
      user,
      loading,
      emailVerified,
      profileStatus,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      resendVerification,
      refreshVerification,
      retryProfile,
      requestPasswordReset,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
