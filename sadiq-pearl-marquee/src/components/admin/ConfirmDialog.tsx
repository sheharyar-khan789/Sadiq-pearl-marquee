"use client";

import { useId, useRef } from "react";
import { useDialog } from "../useDialog";

/**
 * Confirmation step for consequential admin actions. Nothing is sent until the
 * admin presses the confirm button inside the dialog.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  busy,
  onConfirm,
  onClose,
  reason,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Optional reason textarea (stored in the audit trail). */
  reason?: { value: string; onChange: (v: string) => void; label: string };
}) {
  const uid = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useDialog(open, busy ? () => undefined : onClose, panelRef);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
      <div className="absolute inset-0 bg-espresso/60" onClick={busy ? undefined : onClose} />
      <div ref={panelRef} className="relative max-h-[90svh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-frame sm:max-w-lg sm:rounded-2xl sm:p-6">
        <h2 id={`${uid}-title`} className="text-lg font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">{children}</div>
        {reason && (
          <div className="mt-4">
            <label htmlFor={`${uid}-reason`} className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
              {reason.label}
            </label>
            <textarea
              id={`${uid}-reason`}
              rows={3}
              maxLength={1000}
              value={reason.value}
              onChange={(e) => reason.onChange(e.target.value)}
              className="block w-full rounded-xl border border-line-strong/50 bg-surface px-3 py-2 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40"
            />
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} className="btn btn-outline btn-sm">
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className={`btn btn-sm ${danger ? "bg-red-700 text-white hover:bg-red-800" : "btn-primary"}`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
