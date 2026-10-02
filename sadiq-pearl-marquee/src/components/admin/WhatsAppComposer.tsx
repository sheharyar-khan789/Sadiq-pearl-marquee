"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { WhatsAppTemplate } from "@/lib/booking/notifications";
import { NoticeLine, type Notice } from "./BookingActions";

export interface ComposerOption {
  key: string;
  label: string;
  template: WhatsAppTemplate;
  paymentId?: string;
  quotationId?: string;
  assignmentId?: string;
}

function newKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Manual WhatsApp: the server builds the text from real records (preview),
 * then records it as "initiated" and returns the wa.me link, which opens in a
 * new tab. Whether it is actually sent or delivered happens inside WhatsApp
 * and is never claimed here.
 */
export default function WhatsAppComposer({
  bookingId,
  options,
  recipientLabel,
  unavailable,
}: {
  bookingId: string;
  options: ComposerOption[];
  recipientLabel: string;
  /** Why messaging isn't possible (e.g. no usable phone number); null when it is. */
  unavailable: string | null;
}) {
  const uid = useId();
  const router = useRouter();
  const [choice, setChoice] = useState(options[0]?.key ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [requestKey, setRequestKey] = useState(newKey);
  /** Set when the browser blocked the new tab: the admin opens WhatsApp from this link instead. */
  const [blockedLink, setBlockedLink] = useState<string | null>(null);
  const option = options.find((o) => o.key === choice);

  const body = (extra: object) => ({
    bookingId,
    template: option!.template,
    paymentId: option!.paymentId ?? null,
    quotationId: option!.quotationId ?? null,
    assignmentId: option!.assignmentId ?? null,
    ...extra,
  });
  const call = async (payload: object) => {
    const res = await fetch("/api/admin/communications/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true as const, data };
    const message =
      res.status === 401 ? "Your session has expired. Sign in again." : res.status === 403 ? "You are not authorised to do this." : data.message ?? "The message could not be prepared.";
    return { ok: false as const, message };
  };

  const doPreview = async () => {
    if (!option) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await call(body({ preview: true }));
      if (r.ok) setPreview(r.data.message);
      else {
        setPreview(null);
        setNotice({ tone: "error", message: r.message });
      }
    } catch {
      setNotice({ tone: "error", message: "Network error — nothing was prepared." });
    } finally {
      setBusy(false);
    }
  };

  const open = async () => {
    if (!option || !preview) return;
    // Open the tab synchronously (popup blockers), then point it at wa.me once the server has recorded the message.
    const tab = window.open("", "_blank");
    setBusy(true);
    setNotice(null);
    try {
      const r = await call(body({ requestKey }));
      if (!r.ok || typeof r.data.url !== "string" || !r.data.url.startsWith("https://wa.me/")) {
        tab?.close();
        setNotice({ tone: "error", message: r.ok ? "Unexpected response. Nothing was opened." : r.message });
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = r.data.url;
        setBlockedLink(null);
        setNotice({ tone: "info", message: "WhatsApp opened. Delivery is handled by WhatsApp — this system can’t confirm the message was sent or received." });
      } else {
        // Pop-up blocked: stay on this page and offer the link (never navigate away from the admin panel).
        setBlockedLink(r.data.url);
        setNotice({ tone: "info", message: "Message recorded. Your browser blocked the new tab — use “Open WhatsApp” below. Delivery is handled by WhatsApp; this system can’t confirm it was sent or received." });
      }
      setPreview(null);
      setRequestKey(newKey());
      router.refresh();
    } catch {
      tab?.close();
      setNotice({ tone: "error", message: "Network error — nothing was recorded or opened. Try again." });
    } finally {
      setBusy(false);
    }
  };

  if (unavailable) return <p className="text-sm text-ink-muted">{unavailable}</p>;
  if (!options.length) return <p className="text-sm text-ink-muted">No message applies to this booking right now.</p>;

  return (
    <div className="space-y-3">
      <NoticeLine notice={notice} />
      {blockedLink && (
        <a href={blockedLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" onClick={() => setBlockedLink(null)}>
          Open WhatsApp
        </a>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${uid}-t`} className="mb-1 block text-xs font-semibold text-ink">Message to {recipientLabel}</label>
          <select
            id={`${uid}-t`}
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setPreview(null);
              setBlockedLink(null);
            }}
            className="block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40"
          >
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || !option} onClick={doPreview}>
          {busy && !preview ? "Preparing…" : "Preview"}
        </button>
      </div>
      {preview && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink">Preview (built from the booking records — check it before opening)</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-line bg-surface-low p-3 font-body text-sm text-ink">{preview}</pre>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={open}>
            {busy ? "Opening…" : "Open in WhatsApp"}
          </button>
          <p className="text-xs text-ink-muted">Opening records this message as “initiated”. You can still edit it in WhatsApp before sending.</p>
        </div>
      )}
    </div>
  );
}
