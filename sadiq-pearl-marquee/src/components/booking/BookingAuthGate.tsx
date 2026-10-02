"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { NoticeBox } from "../auth/fields";
import GoogleButton from "../auth/GoogleButton";
import Icon from "../Icon";

/**
 * Shown on /book to signed-out visitors instead of the booking flow. Every
 * option returns to `returnTo` (the booking page, with any chosen date/slot),
 * so the customer continues straight into their booking after signing in.
 */
export default function BookingAuthGate({ returnTo }: { returnTo: string }) {
  return (
    <AuthProvider>
      <Gate returnTo={returnTo} />
    </AuthProvider>
  );
}

function Gate({ returnTo }: { returnTo: string }) {
  const { configured, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [pending, setPending] = useState(false);
  const next = encodeURIComponent(returnTo);

  const onGoogle = async () => {
    setNotice(null);
    setPending(true);
    const result = await signInWithGoogle();
    if (result.ok) {
      router.replace(returnTo);
      router.refresh();
      return;
    }
    setNotice(result.notice);
    setPending(false);
  };

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-8 lg:p-10">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-gold-pale text-gold">
        <Icon name="user" className="h-5 w-5" />
      </span>
      <h2 className="mt-5 font-display text-[1.75rem] leading-tight text-ink sm:text-[2rem]">Sign in to book</h2>
      <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
        Please sign in or create a customer account to continue with your booking. Your requests and their status then
        stay in your account.
      </p>

      <div className="mt-8 max-w-md space-y-4">
        <NoticeBox notice={notice} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/login?next=${next}`} className="btn btn-primary w-full">
            Login
          </Link>
          <Link href={`/signup?next=${next}`} className="btn btn-outline w-full">
            Create Account
          </Link>
        </div>
        {configured && <GoogleButton onClick={onGoogle} disabled={pending} busy={pending} />}
      </div>
    </div>
  );
}
