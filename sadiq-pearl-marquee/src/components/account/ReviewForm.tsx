"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { REVIEW_STATUS_LABELS, REVIEW_TEXT_MAX, REVIEW_TEXT_MIN, type ReviewStatus } from "@/lib/booking/reviews";

/**
 * The customer's review of their completed event. Submitting (or editing)
 * sends it for approval; it is published only after the venue approves it.
 */
export default function ReviewForm({
  bookingId,
  existing,
  defaultName,
}: {
  bookingId: string;
  existing: { rating: number; text: string; displayName: string; status: ReviewStatus } | null;
  defaultName: string;
}) {
  const uid = useId();
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? "");
  const [name, setName] = useState(existing?.displayName ?? defaultName);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setNotice({ tone: "error", text: "Choose a rating from 1 to 5 stars." });
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/account/bookings/${bookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ rating, text: text.trim(), displayName: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setNotice({ tone: "info", text: "Thank you! Your review was sent and will appear on our website once it is approved." });
        router.refresh();
      } else {
        setNotice({ tone: "error", text: res.status === 401 ? "Your session has expired. Please sign in again." : data.message ?? "Your review couldn't be saved. Please try again." });
      }
    } catch {
      setNotice({ tone: "error", text: "Network error — please check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {existing && (
        <p className="text-sm text-ink-soft">
          Status: <strong className="text-ink">{REVIEW_STATUS_LABELS[existing.status]}</strong>
          {existing.status === "approved" && " — editing it will send it for approval again."}
        </p>
      )}
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {notice.text}
        </p>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink">Your rating</legend>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl border px-3 text-sm font-semibold ${rating === n ? "border-ink bg-espresso text-white" : "border-line-strong/60 text-ink"}`}>
              <input type="radio" name={`${uid}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} className="sr-only" />
              {n} <span aria-hidden="true">★</span>
              <span className="sr-only"> star{n === 1 ? "" : "s"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor={`${uid}-text`} className="mb-1 block text-sm font-semibold text-ink">Your review</label>
        <textarea
          id={`${uid}-text`}
          rows={4}
          minLength={REVIEW_TEXT_MIN}
          maxLength={REVIEW_TEXT_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40"
        />
        <p className="mt-1 text-xs text-ink-muted">{text.trim().length}/{REVIEW_TEXT_MAX} characters (at least {REVIEW_TEXT_MIN}).</p>
      </div>
      <div>
        <label htmlFor={`${uid}-name`} className="mb-1 block text-sm font-semibold text-ink">Name to show with your review</label>
        <input id={`${uid}-name`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40" />
        <p className="mt-1 text-xs text-ink-muted">Shown publicly. You can use a first name or initials.</p>
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? "Sending…" : existing ? "Update review" : "Send review"}
      </button>
    </form>
  );
}
