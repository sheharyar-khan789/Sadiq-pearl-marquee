"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import { useAuth, type AuthResult } from "./AuthProvider";
import { Divider, isValidEmail, NoticeBox, TextField } from "./fields";
import GoogleButton from "./GoogleButton";
import NotConfigured from "./NotConfigured";

export default function LoginForm({ next }: { next: string }) {
  const { configured, signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [pending, setPending] = useState<null | "email" | "google">(null);

  if (!configured) return <NotConfigured />;

  const finish = (result: AuthResult) => {
    if (result.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setNotice(result.notice);
    setPending(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!isValidEmail(email)) found.email = "Please enter a valid email address.";
    if (!password) found.password = "Please enter your password.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;
    setPending("email");
    finish(await signIn(email, password));
  };

  const onGoogle = async () => {
    setNotice(null);
    setPending("google");
    finish(await signInWithGoogle());
  };

  const signupHref = next === "/account" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />
      <GoogleButton onClick={onGoogle} disabled={pending !== null} busy={pending === "google"} />
      <Divider label="or" />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <div className="-mt-2 flex justify-end">
          <Link
            href="/forgot-password"
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-gold underline-offset-4 hover:text-ink hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <button type="submit" disabled={pending !== null} aria-busy={pending === "email" || undefined} className="btn btn-primary w-full">
          {pending === "email" ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-ink-soft">
        New to Sadiq Pearl?{" "}
        <Link href={signupHref} className="font-semibold text-gold underline-offset-4 hover:text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
