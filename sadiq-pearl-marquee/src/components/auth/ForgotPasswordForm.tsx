"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import { useAuth } from "./AuthProvider";
import { isValidEmail, NoticeBox, TextField } from "./fields";
import NotConfigured from "./NotConfigured";

const COOLDOWN_SECONDS = 60;
const STORAGE_KEY = "sp-reset-sent-at";

/** Seconds left before another reset email may be requested from this browser. */
function remainingCooldown(): number {
  try {
    const sentAt = Number(window.sessionStorage.getItem(STORAGE_KEY));
    if (!sentAt) return 0;
    return Math.max(0, COOLDOWN_SECONDS - Math.floor((Date.now() - sentAt) / 1000));
  } catch {
    return 0;
  }
}

export default function ForgotPasswordForm() {
  const { configured, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // sessionStorage is browser-only: read it after mount, never during render.
    const tick = () => setCooldown(remainingCooldown());
    const first = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, []);

  if (!configured) return <NotConfigured />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(undefined);
    if (remainingCooldown() > 0) return;
    setPending(true);
    const result = await requestPasswordReset(email);
    setPending(false);
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* storage unavailable: cooldown is best-effort */
    }
    setCooldown(COOLDOWN_SECONDS);
    setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <div className="space-y-6">
        <div role="status" className="space-y-3 rounded-2xl border border-gold-container/40 bg-gold-pale/30 p-5">
          <p className="text-[0.9375rem] leading-relaxed text-ink">
            If an account with a password exists for <strong className="font-semibold">{sentTo}</strong>, we&rsquo;ve
            emailed a link to reset it. Check your inbox and spam folder; the link expires after a short time.
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            Signed up with Google? You don&rsquo;t have a password with us &mdash; just use{" "}
            <strong className="font-semibold text-ink">Continue with Google</strong> on the sign-in page.
          </p>
        </div>
        <Link href="/login" className="btn btn-primary w-full">
          Back to sign in
        </Link>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          disabled={cooldown > 0}
          className="btn btn-outline w-full"
        >
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Use a different email or send again"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          required
        />
        <button
          type="submit"
          disabled={pending || cooldown > 0}
          aria-busy={pending || undefined}
          className="btn btn-primary w-full"
        >
          {pending ? "Sending…" : cooldown > 0 ? `You can send again in ${cooldown}s` : "Send reset link"}
        </button>
      </form>
      <p className="text-center text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-gold underline-offset-4 hover:text-ink hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
