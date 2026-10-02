import Link from "next/link";
import type { AdminBookingRow } from "@/lib/booking/admin-view";
import { SOURCE_LABELS, statusLabel } from "@/lib/booking/admin-view";
import type { SlotState } from "@/lib/booking/availability";
import { formatEventDate, formatTimestamp } from "@/lib/booking/format";
import type { BookingStatus } from "@/lib/booking/status";
import Icon, { type IconName } from "../Icon";

// Operational admin UI: clear, dense, readable. Status = icon + text, never colour alone.

const STATUS_STYLE: Record<BookingStatus, { icon: IconName; cls: string }> = {
  pending: { icon: "clock", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  under_review: { icon: "eye", cls: "border-sky-300 bg-sky-50 text-sky-900" },
  confirmed: { icon: "check", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  completed: { icon: "star", cls: "border-line-strong bg-surface-low text-ink" },
  cancelled: { icon: "close", cls: "border-line-strong bg-surface-mid text-ink-soft" },
  rejected: { icon: "close", cls: "border-red-200 bg-red-50 text-red-900" },
  expired: { icon: "alert", cls: "border-line-strong bg-surface-mid text-ink-soft" },
};

export function StatusPill({ status, lapsed = false }: { status: BookingStatus; lapsed?: boolean }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      <Icon name={s.icon} className="h-3.5 w-3.5" />
      {statusLabel(status)}
      {lapsed && <span className="font-normal">· hold lapsed</span>}
    </span>
  );
}

const SLOT_STATE: Record<SlotState, { label: string; cls: string; icon: IconName }> = {
  available: { label: "Available", cls: "text-emerald-800", icon: "check" },
  held: { label: "On hold", cls: "text-amber-800", icon: "clock" },
  booked: { label: "Booked", cls: "text-ink", icon: "shield" },
  closed: { label: "Closed", cls: "text-ink-muted", icon: "close" },
};

export function SlotStateText({ state }: { state: SlotState | null }) {
  if (!state) return <span className="text-ink-muted">Unknown</span>;
  const s = SLOT_STATE[state];
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${s.cls}`}>
      <Icon name={s.icon} className="h-3.5 w-3.5" />
      {s.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-medium leading-tight text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Panel({ title, children, action, id }: { title: string; children: React.ReactNode; action?: React.ReactNode; id?: string }) {
  const headingId = id ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line-strong/60 px-4 py-6 text-center text-sm text-ink-muted">{children}</p>;
}

export function AdminError({ reason, retryHref }: { reason: "unavailable" | "error"; retryHref: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
      <p className="font-semibold">{reason === "unavailable" ? "The booking database is not configured." : "The booking database didn't respond."}</p>
      <p className="mt-1">No data is shown rather than showing something possibly wrong.</p>
      <a href={retryHref} className="btn btn-outline btn-sm mt-3 border-red-300 text-red-900">
        Try again
      </a>
    </div>
  );
}

/** Bookings as a table on wide screens and as cards on phones (no page-wide horizontal scroll). */
export function BookingRows({ rows, showCreated = false }: { rows: AdminBookingRow[]; showCreated?: boolean }) {
  if (!rows.length) return <Empty>No bookings match.</Empty>;
  return (
    <>
      <ul className="space-y-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.bookingId}>
            <Link
              href={`/admin/bookings/${r.bookingId}`}
              className="block rounded-xl border border-line bg-surface p-3 hover:border-ink/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{formatEventDate(r.eventDate, "short")} · {r.slotLabel}</p>
                  <p className="break-words text-sm text-ink-soft">{r.customerName || "—"} · {r.eventTypeLabel}</p>
                </div>
                <StatusPill status={r.status} lapsed={r.holdLapsed} />
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">
                <span className="font-mono">{r.reference}</span> · {r.guestCount.toLocaleString("en-US")} guests · {SOURCE_LABELS[r.source]}
                {showCreated && <> · submitted {formatTimestamp(r.createdAt)}</>}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Ref</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Slot</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Customer</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Event</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Guests</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
              <th scope="col" className="py-2 font-semibold">{showCreated ? "Submitted" : "Source"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bookingId} className="border-b border-line/70 hover:bg-surface-low">
                <td className="py-2 pr-3">
                  <Link href={`/admin/bookings/${r.bookingId}`} className="font-mono font-semibold text-gold underline-offset-2 hover:underline">
                    {r.reference}
                  </Link>
                </td>
                <td className="whitespace-nowrap py-2 pr-3">{formatEventDate(r.eventDate, "short")}</td>
                <td className="py-2 pr-3">{r.slotLabel}</td>
                <td className="max-w-[14rem] py-2 pr-3">
                  <span className="block truncate">{r.customerName || "—"}</span>
                </td>
                <td className="py-2 pr-3">{r.eventTypeLabel}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.guestCount.toLocaleString("en-US")}</td>
                <td className="py-2 pr-3">
                  <StatusPill status={r.status} lapsed={r.holdLapsed} />
                </td>
                <td className="whitespace-nowrap py-2">{showCreated ? formatTimestamp(r.createdAt) : SOURCE_LABELS[r.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
