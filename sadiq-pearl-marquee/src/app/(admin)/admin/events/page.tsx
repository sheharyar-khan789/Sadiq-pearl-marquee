import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader, StatusPill } from "@/components/admin/AdminUi";
import { FinancialStatusPill } from "@/components/admin/FinancePanel";
import { OpsStatusPill } from "@/components/admin/OpsUi";
import { businessToday } from "@/lib/booking/dates";
import { formatEventDate, formatPKR } from "@/lib/booking/format";
import { OPS_STATUS_LABELS, OPS_STATUSES } from "@/lib/booking/operations-model";
import { EVENT_RANGE_LABELS, EVENT_RANGES, parseEventsQuery } from "@/lib/booking/operations-view";
import { loadEvents } from "@/lib/booking/operations-server";

export const metadata: Metadata = { title: "Events" };

const field =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const label = "mb-1 block text-xs font-semibold text-ink";

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseEventsQuery(params, businessToday(new Date()));
  const result = await loadEvents(query);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Events"
        subtitle="Confirmed events and their preparation. Dates, guests and status come from the bookings."
        action={<Link href="/admin/calendar?view=week" className="btn btn-outline btn-sm self-start">Week calendar</Link>}
      />

      <nav aria-label="Quick ranges" className="flex flex-wrap gap-2">
        {EVENT_RANGES.filter((r) => r !== "custom").map((r) => (
          <Link
            key={r}
            href={`/admin/events?range=${r}`}
            aria-current={query.range === r ? "page" : undefined}
            className={`btn btn-sm ${query.range === r ? "btn-primary" : "btn-outline"}`}
          >
            {EVENT_RANGE_LABELS[r]}
          </Link>
        ))}
      </nav>

      {/* Plain GET form: filtering and search run on the server over a bounded date range. */}
      <form method="get" action="/admin/events" className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4 lg:grid-cols-7">
        <input type="hidden" name="range" value="custom" />
        <div className="col-span-2 sm:col-span-4 lg:col-span-2">
          <label htmlFor="e-q" className={label}>Search (ref, name, phone, date, event)</label>
          <input id="e-q" name="q" defaultValue={query.q} className={field} />
        </div>
        <div>
          <label htmlFor="e-from" className={label}>From</label>
          <input id="e-from" name="from" type="date" defaultValue={query.from} className={field} />
        </div>
        <div>
          <label htmlFor="e-to" className={label}>To</label>
          <input id="e-to" name="to" type="date" defaultValue={query.to} className={field} />
        </div>
        <div>
          <label htmlFor="e-slot" className={label}>Slot</label>
          <select id="e-slot" name="slot" defaultValue={query.slot ?? ""} className={field}>
            <option value="">Any</option>
            {result.ok && result.data.slots.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="e-ops" className={label}>Operations</label>
          <select id="e-ops" name="ops" defaultValue={query.ops ?? ""} className={field}>
            <option value="">Any</option>
            {OPS_STATUSES.map((s) => <option key={s} value={s}>{OPS_STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="e-booking" className={label}>Booking</label>
          <select id="e-booking" name="booking" defaultValue={query.booking} className={field}>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="all">Both</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-7">
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          <Link href="/admin/events" className="btn btn-outline btn-sm">Reset</Link>
        </div>
      </form>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/events" />
      ) : (
        <section aria-label="Events" className="space-y-3">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {result.data.rows.length} event{result.data.rows.length === 1 ? "" : "s"} · {query.from === query.to ? formatEventDate(query.from, "short") : `${formatEventDate(query.from, "short")} – ${formatEventDate(query.to, "short")}`}
            {result.data.truncated && " · the range is very busy; narrow it to see everything"}
          </p>
          {result.data.rows.length === 0 ? (
            <Empty>No confirmed events match.</Empty>
          ) : (
            <ul className="space-y-3">
              {result.data.rows.map((r) => (
                <li key={r.bookingId}>
                  <Link href={`/admin/events/${r.bookingId}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-ink/40">
                    <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <span className="min-w-0">
                        <span className="block font-semibold text-ink">
                          {formatEventDate(r.eventDate)} · {r.slotLabel}
                          {r.eventDate === result.data.today && <span className="ml-2 rounded bg-gold-pale px-1.5 text-xs">Today</span>}
                        </span>
                        <span className="block text-sm text-ink-soft">
                          {r.customerName || "—"} · {r.eventTypeLabel} · {r.guestCount.toLocaleString("en-US")} guests · {r.hallName} · <span className="font-mono">{r.reference}</span>
                        </span>
                        <span className="mt-1 block text-xs text-ink-muted">
                          {r.checklistTotal ? `Checklist ${r.checklistDone}/${r.checklistTotal}` : "Checklist not started"}
                          {r.remaining !== null && r.remaining > 0 && ` · remaining ${formatPKR(r.remaining)}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap gap-1.5">
                        <StatusPill status={r.bookingStatus} />
                        <OpsStatusPill status={r.opsStatus} />
                        <FinancialStatusPill status={r.financialStatus} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
