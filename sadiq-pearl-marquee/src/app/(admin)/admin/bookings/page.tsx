import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, BookingRows, PageHeader } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { ADMIN_STATUS_LABELS, parseAdminListQuery, SOURCE_LABELS } from "@/lib/booking/admin-view";
import { loadBookingList } from "@/lib/booking/admin-server";
import { loadConfigFresh } from "@/lib/config/config-server";
import { DEFAULT_CONFIG } from "@/lib/config/business-config";
import { businessToday } from "@/lib/booking/dates";
import { BOOKING_SOURCES } from "@/lib/booking/model";
import { BOOKING_STATUSES } from "@/lib/booking/status";

export const metadata: Metadata = { title: "Bookings" };

const field = "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40";
const label = "mb-1 block text-xs font-semibold text-ink";

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parseAdminListQuery(params, businessToday(new Date()));
  const result = await loadBookingList(query);
  const cfg = await loadConfigFresh();
  // Filter options include inactive records, so older bookings stay findable.
  const config = cfg.ok ? cfg.config : DEFAULT_CONFIG;
  const pageHref = (page: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== "" && k !== "page") sp.set(k, String(v));
    sp.set("page", String(page));
    return `/admin/bookings?${sp}`;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bookings"
        action={
          <Link href="/admin/bookings/new" className="btn btn-primary btn-sm self-start">
            <Icon name="calendar" className="h-4 w-4" />
            New booking
          </Link>
        }
      />

      {/* Plain GET form: filtering, search, sorting and paging all happen on the server. */}
      <form method="get" action="/admin/bookings" className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-4 lg:grid-cols-8">
        <div className="col-span-2 sm:col-span-4 lg:col-span-2">
          <label htmlFor="f-q" className={label}>Search (ref, name, email, phone)</label>
          <input id="f-q" name="q" defaultValue={query.q} className={field} />
        </div>
        <div>
          <label htmlFor="f-from" className={label}>From</label>
          <input id="f-from" name="from" type="date" defaultValue={query.from} className={field} />
        </div>
        <div>
          <label htmlFor="f-to" className={label}>To</label>
          <input id="f-to" name="to" type="date" defaultValue={query.to} className={field} />
        </div>
        <div>
          <label htmlFor="f-status" className={label}>Status</label>
          <select id="f-status" name="status" defaultValue={query.status} className={field}>
            <option value="">Any</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>{ADMIN_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-slot" className={label}>Slot</label>
          <select id="f-slot" name="slot" defaultValue={query.slot} className={field}>
            <option value="">Any</option>
            {config.slots.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-source" className={label}>Source</label>
          <select id="f-source" name="source" defaultValue={query.source} className={field}>
            <option value="">Any</option>
            {BOOKING_SOURCES.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-event" className={label}>Event</label>
          <select id="f-event" name="eventType" defaultValue={query.eventType} className={field}>
            <option value="">Any</option>
            {config.eventTypes.map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className={label}>Sort</label>
          <select id="f-sort" name="sort" defaultValue={query.sort} className={field}>
            <option value="date_asc">Event date ↑</option>
            <option value="date_desc">Event date ↓</option>
            <option value="created_desc">Newest submitted</option>
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4 lg:col-span-8">
          <button type="submit" className="btn btn-primary btn-sm">Apply</button>
          <Link href="/admin/bookings" className="btn btn-outline btn-sm">Reset</Link>
        </div>
      </form>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/bookings" />
      ) : (
        <section aria-label="Results" className="space-y-3">
          <p className="text-sm text-ink-soft" aria-live="polite">
            {result.data.total} booking{result.data.total === 1 ? "" : "s"} · {query.from} to {query.to}
          </p>
          <BookingRows rows={result.data.rows} />
          {result.data.pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-2 text-sm">
              {result.data.page > 1 ? <Link href={pageHref(result.data.page - 1)} className="btn btn-outline btn-sm">Previous</Link> : <span />}
              <span className="text-ink-muted">Page {result.data.page} of {result.data.pages}</span>
              {result.data.page < result.data.pages ? <Link href={pageHref(result.data.page + 1)} className="btn btn-outline btn-sm">Next</Link> : <span />}
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
