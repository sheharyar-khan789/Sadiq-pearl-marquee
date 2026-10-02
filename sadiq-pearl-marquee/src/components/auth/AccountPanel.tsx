"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import Icon from "../Icon";
import { useAuth } from "./AuthProvider";
import { NoticeBox } from "./fields";

const RESEND_COOLDOWN_SECONDS = 60;

export interface AccountSummary {
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
}

/** Account status: identity, email verification and sign-out. Not a dashboard. */
export default function AccountPanel({ initial }: { initial: AccountSummary }) {
  const router = useRouter();
  const { user, loading, profileStatus, resendVerification, refreshVerification, retryProfile, signOut } = useAuth();
  const [verified, setVerified] = useState(initial.emailVerified);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [busy, setBusy] = useState<null | "resend" | "check" | "profile" | "signout">(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const isPassword = initial.signInProvider === "password";
  const displayName = user?.displayName ?? initial.name;
  const email = user?.email ?? initial.email;
  const clientMissing = !loading && !user; // server session exists but browser session was cleared

  const onResend = async () => {
    setBusy("resend");
    setNotice(null);
    const result = await resendVerification();
    if (result.ok) {
      setNotice({ tone: "info", message: `We sent a new verification link to ${email}. Check your inbox and spam folder.` });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } else setNotice(result.notice);
    setBusy(null);
  };

  const onCheck = async () => {
    setBusy("check");
    setNotice(null);
    const result = await refreshVerification();
    if (!result.ok) setNotice(result.notice);
    else if (result.verified) {
      setVerified(true);
      setNotice({ tone: "info", message: "Thank you — your email address is verified." });
      router.refresh();
    } else {
      setNotice({
        tone: "info",
        message: "Your email isn't verified yet. Open the link in the email we sent, then check again.",
      });
    }
    setBusy(null);
  };

  const onRetryProfile = async () => {
    setBusy("profile");
    const result = await retryProfile();
    setNotice(result.ok ? { tone: "info", message: "Your profile is set up." } : result.notice);
    setBusy(null);
  };

  const onSignOut = async () => {
    setBusy("signout");
    await signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />

      <section aria-labelledby="identity-title" className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-espresso font-display text-2xl text-gold-light"
          >
            {(displayName || email || "?").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 id="identity-title" className="truncate font-display text-[1.75rem] leading-tight text-ink">
              {displayName || "Your account"}
            </h2>
            <p className="truncate text-sm text-ink-muted">{email}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink-muted">Signed in with</dt>
            <dd className="mt-0.5 font-semibold text-ink">{isPassword ? "Email and password" : "Google"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Email status</dt>
            <dd className="mt-0.5">
              {verified ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Icon name="check" className="h-4 w-4" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800">
                  <Icon name="alert" className="h-4 w-4" /> Not verified yet
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {!verified && (
        <section aria-labelledby="verify-title" className="rounded-3xl border border-gold-container/40 bg-gold-pale/30 p-6 sm:p-8">
          <h2 id="verify-title" className="font-display text-2xl text-ink">
            Please verify your email
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            We sent a verification link to <strong className="font-semibold text-ink">{email}</strong>. Open it on any
            device, then return here and check again. Links expire; if yours has, send a new one.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCheck}
              disabled={busy !== null || clientMissing}
              aria-busy={busy === "check" || undefined}
              className="btn btn-primary"
            >
              {busy === "check" ? "Checking…" : "I've verified — check again"}
            </button>
            <button
              type="button"
              onClick={onResend}
              disabled={busy !== null || cooldown > 0 || clientMissing}
              aria-busy={busy === "resend" || undefined}
              className="btn btn-outline"
            >
              {busy === "resend" ? "Sending…" : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend verification email"}
            </button>
          </div>
        </section>
      )}

      {profileStatus === "error" && (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-900 sm:p-8">
          <p className="text-[0.9375rem] leading-relaxed">
            We couldn&rsquo;t complete your account setup. Please try again.
          </p>
          <button type="button" onClick={onRetryProfile} disabled={busy !== null} className="btn btn-outline mt-4 border-red-300 text-red-900">
            {busy === "profile" ? "Retrying…" : "Try again"}
          </button>
        </section>
      )}

      {clientMissing && (
        <p className="rounded-2xl border border-line bg-surface-low px-5 py-4 text-sm text-ink-soft">
          Your browser session has ended. Please sign out and sign in again to manage your account.
        </p>
      )}


      <div>
        <button
          type="button"
          onClick={onSignOut}
          disabled={busy !== null}
          aria-busy={busy === "signout" || undefined}
          aria-describedby="signout-note"
          className="btn btn-outline w-full sm:w-auto"
        >
          <Icon name="logout" className="h-4 w-4" />
          {busy === "signout" ? "Signing out…" : "Sign out"}
        </button>
        <p id="signout-note" className="mt-2 text-xs text-ink-muted">
          For your security, signing out ends your session on all devices.
        </p>
      </div>
    </div>
  );
}
