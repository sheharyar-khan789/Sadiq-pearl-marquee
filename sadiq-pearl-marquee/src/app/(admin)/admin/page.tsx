import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, BookingRows, Empty, PageHeader, Panel, StatusPill } from "@/components/admin/AdminUi";
import Icon from "@/components/Icon";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import { loadDashboard } from "@/lib/booking/admin-server";

export const metadata: Metadata = { title: "Dashboard" };

function Kpi({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </>
  );
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      {href ? (
        <Link href={href} className="block hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  const r = await loadDashboard();
  if (!r.ok) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <AdminError reason={r.reason} retryHref="/admin" />
      </>
    );
  }
  const d = r.data;
  const todayCount = (slotId: string) => d.todayBySlot.find((s) => s.slotId === slotId)?.bookings.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={`Today is ${formatEventDate(d.today)}`}
        action={
          <Link href="/admin/bookings/new" className="btn btn-primary btn-sm self-start">
            <Icon name="calendar" className="h-4 w-4" />
            New booking
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Today · Day" value={todayCount("day")} />
        <Kpi label="Today · Night" value={todayCount("night")} />
        <Kpi label="Upcoming events" value={d.counts.upcoming} href="/admin/bookings" />
        <Kpi label="Pending" value={d.counts.pending} href="/admin/bookings?status=pending" />
        <Kpi label="Under review" value={d.counts.underReview} href="/admin/bookings?status=under_review" />
        <Kpi label="Confirmed (upcoming)" value={d.counts.confirmedUpcoming} href="/admin/bookings?status=confirmed" />
        <Kpi label="Open change requests" value={d.counts.openRequests} />
        <Kpi label="Free slots · next 30 days" value={d.slots30.available} href="/admin/calendar" />
      </dl>
      <p className="-mt-3 text-xs text-ink-muted">
        Next 30 days: {d.slots30.available} free, {d.slots30.held} on hold, {d.slots30.booked} booked (same availability engine as the public booking page).
      </p>

      <Panel title="Payments">
        {d.pricedBookings === 0 ? (
          <p className="text-sm text-ink-soft">
            <strong className="font-semibold text-ink">No priced upcoming bookings.</strong> Totals appear once bookings carry a stored price.
            No figures are estimated.
          </p>
        ) : (
          <div className="text-sm">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(
                [
                  ["Booked value", d.finance.total],
                  ["Received", d.finance.paid],
                  ["Outstanding", d.finance.outstanding],
                ] as const
              ).map(([label, amount]) => (
                <div key={label}>
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-ink">{formatPKR(amount)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-ink-muted">
              Upcoming pending, under-review and confirmed bookings with a stored price ({d.pricedBookings}), from recorded payments only.
              {d.finance.unpriced > 0 && ` ${d.finance.unpriced} booking(s) have no price yet and are not included.`}
            </p>
          </div>
        )}
      </Panel>

      <Panel title="Today's events">
        <div className="grid gap-3 md:grid-cols-2">
          {d.todayBySlot.map((slot) => (
            <div key={slot.slotId} className="rounded-xl border border-line p-3">
              <p className="text-sm font-semibold text-ink">{slot.slotLabel} slot</p>
              {slot.bookings.length === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">No event in the {slot.slotLabel} slot today.</p>
              ) : (
                slot.bookings.map((b) => (
                  <Link key={b.bookingId} href={`/admin/bookings/${b.bookingId}`} className="mt-2 block rounded-lg bg-surface-low p-2 hover:bg-surface-mid">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{b.customerName || "—"}</span>
                      <StatusPill status={b.status} lapsed={b.holdLapsed} />
                    </div>
                    <p className="text-sm text-ink-soft">
                      {b.eventTypeLabel} · {b.guestCount.toLocaleString("en-US")} guests · <span className="font-mono">{b.reference}</span>
                    </p>
                  </Link>
                ))
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Booking requests waiting" action={<Link href="/admin/bookings?status=pending" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-gold hover:underline">All pending</Link>}>
        {d.pendingRows.length ? <BookingRows rows={d.pendingRows} showCreated /> : <Empty>No pending or under-review requests.</Empty>}
      </Panel>

      <Panel title="Customer change requests">
        {d.openRequests.length === 0 ? (
          <Empty>No open modification or cancellation requests.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {d.openRequests.map(({ request, booking }) => (
              <li key={request.requestId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink">
                    {request.type === "cancellation" ? "Cancellation" : "Change"} · {booking ? `${booking.customerName || "—"} · ${formatEventDate(booking.eventDate, "short")} ${booking.slotLabel}` : request.bookingId}
                  </p>
                  <p className="break-words text-ink-muted">
                    Submitted {formatTimestamp(request.createdAt)}
                    {request.summary.length > 0 && ` · ${request.summary.join(" · ")}`}
                  </p>
                </div>
                <Link href={`/admin/bookings/${request.bookingId}#requests`} className="btn btn-outline btn-sm shrink-0 self-start">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
