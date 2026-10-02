"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { NoticeBox, TextField } from "../auth/fields";
import type { AuthNotice } from "@/lib/auth/errors";

/** Name and phone. Saved by the server (PATCH /api/account/profile) for the signed-in account only. */
export default function ProfileForm({ initial }: { initial: { name: string; phone: string } }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    const found: typeof errors = {};
    if (name.trim().length < 2) found.name = "Please enter your name (2–100 characters).";
    if (phone.trim() && phone.replace(/\D/g, "").length < 10) found.phone = "Please enter a valid phone number, or leave it empty.";
    setErrors(found);
    setNotice(null);
    if (Object.keys(found).length) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setNotice({ tone: "info", message: "Your profile has been saved." });
        router.refresh();
      } else if (res.status === 401) {
        setNotice({ tone: "error", message: "Your session has expired. Please sign in again to save your profile." });
      } else if (res.status === 400 && data.fields) {
        setErrors({ name: data.fields.name?.message, phone: data.fields.phone?.message });
        setNotice({ tone: "error", message: "Please check the highlighted details." });
      } else {
        setNotice({ tone: "error", message: "We couldn't save your profile just now. Please try again in a moment." });
      }
    } catch {
      setNotice({ tone: "error", message: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <NoticeBox notice={notice} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <TextField
          label="Phone / WhatsApp (optional)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={24}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint="Lets our team reach you about your bookings."
          placeholder="03XX XXXXXXX"
        />
      </div>
      <button type="submit" disabled={saving} aria-busy={saving || undefined} className="btn btn-primary w-full sm:w-auto">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
