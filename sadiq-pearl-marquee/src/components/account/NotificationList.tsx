"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NotificationView } from "@/lib/booking/communications";
import { formatTimestamp } from "@/lib/booking/format";

async function post(body: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/account/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, message: res.status === 401 ? "Your session has expired. Please sign in again." : data.message ?? "Couldn't update. Please try again." };
  } catch {
    return { ok: false, message: "Network error — please check your connection and try again." };
  }
}

/** The customer's notifications. Read state is changed only through the server API. */
export default function NotificationList({ items, unread }: { items: NotificationView[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const markOne = async (id: string) => {
    setBusy(id);
    setNotice(null);
    const r = await post({ notificationId: id });
    setBusy(null);
    if (r.ok) router.refresh();
    else setNotice({ tone: "error", text: r.message! });
  };
  const markAll = async () => {
    setBusy("all");
    setNotice(null);
    const r = await post({ all: true });
    setBusy(null);
    if (r.ok) {
      setNotice({ tone: "info", text: "All notifications marked as read." });
      router.refresh();
    } else setNotice({ tone: "error", text: r.message! });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {unread > 0 ? `${unread} unread` : "No unread notifications"}
        </p>
        {unread > 0 && (
          <button type="button" onClick={markAll} disabled={busy !== null} className="btn btn-outline btn-sm self-start">
            {busy === "all" ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>
      {notice && (
        <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${notice.tone === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {notice.text}
        </p>
      )}
      <ul className="space-y-3">
        {items.map((n) => (
          <li key={n.notificationId} className={`rounded-2xl border p-4 sm:p-5 ${n.read ? "border-line bg-surface" : "border-gold/60 bg-gold-pale/20"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-ink">
                  {!n.read && <span className="mr-2 rounded bg-espresso px-1.5 py-0.5 text-xs font-semibold text-white">New</span>}
                  {n.title}
                </p>
                <p className="mt-1 break-words text-[0.9375rem] leading-relaxed text-ink-soft">{n.message}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  <time dateTime={n.createdAt}>{formatTimestamp(n.createdAt)}</time>
                  {n.read ? " · Read" : " · Unread"}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {n.actionUrl && (
                  <Link href={n.actionUrl} onClick={() => !n.read && void post({ notificationId: n.notificationId })} className="btn btn-outline btn-sm">
                    View booking
                  </Link>
                )}
                {!n.read && (
                  <button type="button" onClick={() => markOne(n.notificationId)} disabled={busy !== null} className="btn btn-outline btn-sm" aria-label={`Mark “${n.title}” as read`}>
                    {busy === n.notificationId ? "Marking…" : "Mark as read"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
