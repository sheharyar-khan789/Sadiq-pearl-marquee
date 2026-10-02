"use client";

import { useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from "firebase/auth";
import { getFirebase } from "@/lib/firebase/client";
import { describeAuthError, noticeFor, type AuthNotice } from "@/lib/auth/errors";
import { isValidEmail, NoticeBox, TextField } from "../auth/fields";
import { useAuth } from "../auth/AuthProvider";

/**
 * Changing the sign-in email (email/password accounts). Firebase Auth owns
 * the email: it sends a link to the NEW address and changes the email only
 * after that link is opened (see /auth/action?mode=verifyAndChangeEmail).
 * Nothing changes in Firestore until then.
 */
export default function EmailChangeForm({ currentEmail }: { currentEmail: string }) {
  const { configured, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  if (!configured) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busyRef.current) return;
    const found: typeof errors = {};
    if (!isValidEmail(email)) found.email = "Please enter a valid email address.";
    else if (email.trim().toLowerCase() === currentEmail.toLowerCase()) found.email = "This is already your sign-in email.";
    if (!password) found.password = "Please enter your current password.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;

    const current = getFirebase().auth.currentUser ?? user;
    if (!current || !current.email) {
      setNotice(noticeFor("auth/requires-recent-login"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await reauthenticateWithCredential(current, EmailAuthProvider.credential(current.email, password));
      await verifyBeforeUpdateEmail(current, email.trim(), { url: `${window.location.origin}/login`, handleCodeInApp: false });
      setPassword("");
      setNotice({
        tone: "info",
        message: `We've sent a confirmation link to ${email.trim()}. Your sign-in email changes only after you open it; until then, keep using ${currentEmail}.`,
      });
      setOpen(false);
    } catch (error) {
      setNotice(describeAuthError(error, "email change"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <NoticeBox notice={notice} />
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-outline">
          Change sign-in email
        </button>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Change sign-in email">
          <input type="email" name="username" autoComplete="username" value={currentEmail} readOnly hidden />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="New email address"
              type="email"
              name="new-email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              required
            />
            <TextField
              label="Current password"
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint="Needed to confirm it's you."
              required
            />
          </div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" disabled={busy} aria-busy={busy || undefined} className="btn btn-primary">
              {busy ? "Sending…" : "Send confirmation link"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
