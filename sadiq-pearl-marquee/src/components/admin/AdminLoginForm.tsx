"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { describeAuthError, noticeFor, type AuthNotice } from "@/lib/auth/errors";
import { SUPER_ADMIN_ROLE } from "@/lib/auth/constants";
import { getFirebase } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { isValidEmail, NoticeBox, TextField } from "../auth/fields";
import NotConfigured from "../auth/NotConfigured";

/**
 * Admin sign-in: email + password credentials created in Firebase only. There
 * is deliberately no Google option and no sign-up. The role check here only
 * gives a clear message; the server re-verifies the claim on every admin page
 * and API request (src/lib/auth/server.ts).
 */
export default function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [pending, setPending] = useState(false);

  if (!isFirebaseConfigured) return <NotConfigured />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!isValidEmail(email)) found.email = "Please enter a valid email address.";
    if (!password) found.password = "Please enter your password.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;

    setPending(true);
    const { auth } = getFirebase();
    try {
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await user.getIdTokenResult();
      if (token.claims.role !== SUPER_ADMIN_ROLE || token.claims.email_verified !== true) {
        await signOut(auth);
        setNotice(noticeFor("admin/not-admin"));
        setPending(false);
        return;
      }
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ idToken: token.token }),
      });
      if (!response.ok) {
        await signOut(auth);
        setNotice(noticeFor(response.status === 503 ? "session/unavailable" : "session/failed"));
        setPending(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch (error) {
      setNotice(describeAuthError(error, "admin sign-in"));
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <NoticeBox notice={notice} />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextField
          label="Admin email"
          type="email"
          name="email"
          autoComplete="username"
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
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className="btn btn-primary w-full">
          {pending ? "Signing in…" : "Sign in to admin"}
        </button>
      </form>
    </div>
  );
}
