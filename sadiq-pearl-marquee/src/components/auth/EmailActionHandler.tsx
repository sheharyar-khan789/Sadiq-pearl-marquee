"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyActionCode, confirmPasswordReset, signOut, verifyPasswordResetCode } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { describeAuthError, type AuthNotice } from "@/lib/auth/errors";
import { useAuth } from "./AuthProvider";
import { NoticeBox, TextField } from "./fields";
import NotConfigured from "./NotConfigured";

const MIN_PASSWORD = 8;

/**
 * Handles Firebase email-action links (set as the custom action URL in the
 * Firebase Console): email verification, password reset, and confirming (or
 * undoing) a change of sign-in email. Firebase creates
 * and validates the one-time codes; nothing is stored or logged here.
 */
export default function EmailActionHandler({
  mode,
  oobCode,
  continuePath,
}: {
  mode: string | null;
  oobCode: string | null;
  continuePath: string;
}) {
  const { configured } = useAuth();
  if (!configured) return <NotConfigured />;
  if (mode === "verifyEmail" && oobCode) return <VerifyEmail oobCode={oobCode} continuePath={continuePath} />;
  if (mode === "resetPassword" && oobCode) return <ResetPassword oobCode={oobCode} />;
  if ((mode === "verifyAndChangeEmail" || mode === "recoverEmail") && oobCode) {
    return <ChangeEmail oobCode={oobCode} mode={mode} />;
  }
  return (
    <div className="space-y-5">
      <NoticeBox notice={{ tone: "error", message: "This link isn't valid here. Please use the latest link we emailed you." }} />
      <Link href="/login" className="btn btn-primary w-full">
        Go to sign in
      </Link>
    </div>
  );
}

/** Removes the one-time code from the address bar and browser history. */
function forgetCodeInUrl(mode: string) {
  try {
    window.history.replaceState(null, "", `/auth/action?mode=${mode}`);
  } catch {
    /* non-critical */
  }
}

function VerifyEmail({ oobCode, continuePath }: { oobCode: string; continuePath: string }) {
  const { refreshVerification, authenticated, loading } = useAuth();
  const [state, setState] = useState<"working" | "verified" | "failed">("working");
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    applyActionCode(getFirebase().auth, oobCode)
      .then(() => setState("verified"))
      .catch((error) => {
        setNotice(describeAuthError(error, "email verification link"));
        setState("failed");
      })
      .finally(() => forgetCodeInUrl("verifyEmail"));
  }, [oobCode]);

  // If this browser is signed in, refresh its session so the account page shows "Verified".
  useEffect(() => {
    if (state === "verified" && !loading && authenticated) void refreshVerification();
  }, [state, loading, authenticated, refreshVerification]);

  if (state === "working") {
    return (
      <p role="status" className="text-[0.9375rem] text-ink-soft">
        Verifying your email address…
      </p>
    );
  }

  if (state === "verified") {
    return (
      <div className="space-y-5">
        <NoticeBox notice={{ tone: "info", message: "Your email address is verified. Thank you!" }} />
        <Link href={continuePath} className="btn btn-primary w-full">
          Continue to your account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <NoticeBox notice={notice} />
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
        You can request a new verification email from your account page.
      </p>
      <Link href="/account" className="btn btn-primary w-full">
        Go to your account
      </Link>
    </div>
  );
}

function ResetPassword({ oobCode }: { oobCode: string }) {
  const [state, setState] = useState<"checking" | "ready" | "saving" | "done" | "failed">("checking");
  const [accountEmail, setAccountEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyPasswordResetCode(getFirebase().auth, oobCode)
      .then((email) => {
        setAccountEmail(email);
        setState("ready");
      })
      .catch((error) => {
        setNotice(describeAuthError(error, "password reset link"));
        setState("failed");
      })
      .finally(() => forgetCodeInUrl("resetPassword"));
  }, [oobCode]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (password.length < MIN_PASSWORD) found.password = `Please use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) found.confirm = "The passwords don't match.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;

    setState("saving");
    try {
      const { auth } = getFirebase();
      await confirmPasswordReset(auth, oobCode, password);
      // Changing the password revokes existing sessions; also end any here.
      await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
      if (auth.currentUser) await signOut(auth).catch(() => undefined);
      setPassword("");
      setConfirm("");
      setState("done");
    } catch (error) {
      const result = describeAuthError(error, "password reset");
      const code = (error as { code?: string }).code;
      // Expired/used links can't be retried; password problems can.
      setState(code === "auth/expired-action-code" || code === "auth/invalid-action-code" ? "failed" : "ready");
      setNotice(result);
    }
  };

  if (state === "checking") {
    return (
      <p role="status" className="text-[0.9375rem] text-ink-soft">
        Checking your reset link…
      </p>
    );
  }

  if (state === "done") {
    return (
      <div className="space-y-5">
        <NoticeBox
          notice={{
            tone: "info",
            message: "Your password has been changed. For your security, you've been signed out everywhere.",
          }}
        />
        <Link href="/login" className="btn btn-primary w-full">
          Sign in with your new password
        </Link>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="space-y-5">
        <NoticeBox notice={notice} />
        <Link href="/forgot-password" className="btn btn-primary w-full">
          Request a new reset link
        </Link>
        <Link href="/login" className="btn btn-outline w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
        Choose a new password for <strong className="font-semibold text-ink">{accountEmail}</strong>.
      </p>
      <NoticeBox notice={notice} />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {/* Lets password managers associate the new password with the right account. */}
        <input type="email" name="username" autoComplete="username" value={accountEmail} readOnly hidden />
        <TextField
          label="New password"
          type="password"
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          name="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={errors.confirm}
          required
        />
        <button
          type="submit"
          disabled={state === "saving"}
          aria-busy={state === "saving" || undefined}
          className="btn btn-primary w-full"
        >
          {state === "saving" ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}

/**
 * Confirms a new sign-in email (verifyAndChangeEmail) or restores the previous
 * one (recoverEmail, from the link Firebase sends to the old address). Either
 * way the account's sessions end, and the customer signs in again.
 */
function ChangeEmail({ oobCode, mode }: { oobCode: string; mode: "verifyAndChangeEmail" | "recoverEmail" }) {
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const { auth } = getFirebase();
    applyActionCode(auth, oobCode)
      .then(async () => {
        await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
        if (auth.currentUser) await signOut(auth).catch(() => undefined);
        setState("done");
      })
      .catch((error) => {
        setNotice(describeAuthError(error, "email change link"));
        setState("failed");
      })
      .finally(() => forgetCodeInUrl(mode));
  }, [oobCode, mode]);

  if (state === "working") {
    return (
      <p role="status" className="text-[0.9375rem] text-ink-soft">
        Updating your sign-in email…
      </p>
    );
  }
  if (state === "failed") {
    return (
      <div className="space-y-5">
        <NoticeBox notice={notice} />
        <Link href="/login" className="btn btn-primary w-full">
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <NoticeBox
        notice={{
          tone: "info",
          message:
            mode === "recoverEmail"
              ? "Your previous sign-in email has been restored and you've been signed out. If you didn't ask for the change, please also reset your password."
              : "Your sign-in email has been changed and you've been signed out. Please sign in with your new email address.",
        }}
      />
      <Link href="/login" className="btn btn-primary w-full">
        Sign in
      </Link>
      {mode === "recoverEmail" && (
        <Link href="/forgot-password" className="btn btn-outline w-full">
          Reset my password
        </Link>
      )}
    </div>
  );
}
