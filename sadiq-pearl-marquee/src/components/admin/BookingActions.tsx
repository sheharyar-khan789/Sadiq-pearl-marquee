"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import type { BookingStatus } from "@/lib/booking/status";
import Icon from "../Icon";
import ConfirmDialog from "./ConfirmDialog";

export type Notice = { tone: "error" | "info"; message: string } | null;

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const error = notice.tone === "error";
  return (
    <p
      role={error ? "alert" : "status"}
      className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
    >
      <Icon name={error ? "alert" : "check"} className="mt-0.5 h-4 w-4 shrink-0" />
      {notice.message}
    </p>
  );
}

/** POSTs an admin action; reports server messages (never swallows failures); one request at a time. */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const busyRef = useRef(false);
  const send = useCallback(
    async (url: string, body: unknown, success: string): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setNotice({ tone: "info", message: success });
          router.refresh();
          return true;
        }
        const message =
          res.status === 401
            ? "Your session has expired. Sign in again."
            : res.status === 403
              ? "You are not authorised to do this."
              : data.message ?? "The action could not be completed.";
        setNotice({ tone: "error", message });
        if (data.error === "stale") router.refresh();
        return false;
      } catch {
        setNotice({ tone: "error", message: "Network error — nothing was changed. Check the connection and try again." });
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [router]
  );
  return { busy, notice, setNotice, send };
}

type Action = { to: BookingStatus; label: string; danger?: boolean; needsReason?: boolean; explain: string };

const ACTIONS: Partial<Record<BookingStatus, Action[]>> = {
  pending: [
    { to: "under_review", label: "Mark under review", explain: "The slot stays held (no expiry) while you review." },
    { to: "confirmed", label: "Confirm booking", explain: "The server re-checks the slot now. If another booking has it, nothing changes." },
    { to: "rejected", label: "Reject request", danger: true, needsReason: true, explain: "The request is kept for the record and the slot is released." },
  ],
  under_review: [
    { to: "confirmed", label: "Confirm booking", explain: "The server re-checks the slot now. If another booking has it, nothing changes." },
    { to: "rejected", label: "Reject request", danger: true, needsReason: true, explain: "The request is kept for the record and the slot is released." },
  ],
  confirmed: [
    { to: "completed", label: "Mark completed", explain: "Only on or after the event date. The record keeps the slot." },
    { to: "cancelled", label: "Cancel booking", danger: true, needsReason: true, explain: "The slot is released. No refund is calculated (policy not configured)." },
  ],
};

/** Status buttons allowed from the current status (the server enforces the same map). */
export default function BookingActions({
  bookingId,
  status,
  updatedAt,
}: {
  bookingId: string;
  status: BookingStatus;
  updatedAt: string;
}) {
  const { busy, notice, send } = useAdminAction();
  const [pending, setPending] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const actions = ACTIONS[status] ?? [];

  const confirm = async () => {
    if (!pending) return;
    const ok = await send(
      `/api/admin/bookings/${bookingId}/status`,
      { to: pending.to, reason: reason.trim(), expectedUpdatedAt: updatedAt },
      `Done: ${pending.label.toLowerCase()}.`
    );
    if (ok) {
      setPending(null);
      setReason("");
    } else setPending(null);
  };

  if (!actions.length) {
    return (
      <div className="space-y-2">
        <NoticeLine notice={notice} />
        <p className="text-sm text-ink-muted">No status changes are possible from this status.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <NoticeLine notice={notice} />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.to}
            type="button"
            onClick={() => setPending(a)}
            disabled={busy}
            className={`btn btn-sm ${a.danger ? "border border-red-300 text-red-800 hover:bg-red-50" : a.to === "confirmed" ? "btn-primary" : "btn-outline"}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      <ConfirmDialog
        open={pending !== null}
        title={pending ? `${pending.label}?` : ""}
        confirmLabel={pending?.label ?? ""}
        danger={pending?.danger}
        busy={busy}
        onConfirm={confirm}
        onClose={() => setPending(null)}
        reason={pending?.needsReason ? { value: reason, onChange: setReason, label: "Reason (optional, internal — kept in the audit trail)" } : undefined}
      >
        <p>{pending?.explain}</p>
      </ConfirmDialog>
    </div>
  );
}
