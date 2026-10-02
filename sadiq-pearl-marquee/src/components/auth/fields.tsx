"use client";

import { useId, useState } from "react";
import type { AuthNotice } from "@/lib/auth/errors";
import Icon from "../Icon";

const inputClass =
  "block h-12 w-full rounded-xl border border-line-strong/50 bg-surface px-4 text-[0.9375rem] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600";

export function TextField({
  label,
  error,
  hint,
  type = "text",
  ...input
}: {
  label: string;
  error?: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${inputClass} ${isPassword ? "pr-14" : ""}`}
          {...input}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-muted hover:text-ink"
          >
            <Icon name={reveal ? "eyeOff" : "eye"} className="h-5 w-5" />
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Error/info banner; announced to screen readers when it appears. */
export function NoticeBox({ notice }: { notice: AuthNotice | null }) {
  if (!notice) return null;
  const error = notice.tone === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-gold-container/40 bg-gold-pale/40 text-ink"
      }`}
    >
      <Icon name={error ? "alert" : "check"} className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{notice.message}</p>
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
