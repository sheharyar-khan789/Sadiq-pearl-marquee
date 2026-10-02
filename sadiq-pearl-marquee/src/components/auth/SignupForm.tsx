"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import { useAuth, type AuthResult } from "./AuthProvider";
import { Divider, isValidEmail, NoticeBox, TextField } from "./fields";
import GoogleButton from "./GoogleButton";
import NotConfigured from "./NotConfigured";

const MIN_PASSWORD = 8;

export default function SignupForm({ next }: { next: string }) {
  const { configured, signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
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
    const trimmed = name.trim();
    if (trimmed.length < 2) found.name = "Please enter your full name.";
    else if (trimmed.length > 100) found.name = "Please keep your name under 100 characters.";
    if (!isValidEmail(email)) found.email = "Please enter a valid email address.";
    if (password.length < MIN_PASSWORD) found.password = `Please use at least ${MIN_PASSWORD} characters.`;
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;
    setPending("email");
    finish(await signUp(trimmed, email, password));
  };

  const onGoogle = async () => {
    setNotice(null);
    setPending("google");
    finish(await signInWithGoogle());
  };

  const loginHref = next === "/account" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />
      <GoogleButton onClick={onGoogle} disabled={pending !== null} busy={pending === "google"} />
      <Divider label="or" />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          maxLength={100}
          required
        />
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
          name="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint={`At least ${MIN_PASSWORD} characters.`}
          required
        />
        <button type="submit" disabled={pending !== null} aria-busy={pending === "email" || undefined} className="btn btn-primary w-full">
          {pending === "email" ? "Creating your account…" : "Create account"}
        </button>
        <p className="text-xs leading-relaxed text-ink-muted">
          We&rsquo;ll email you a link to verify your address. Creating an account does not book or reserve a date.
        </p>
      </form>
      <p className="text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-gold underline-offset-4 hover:text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
