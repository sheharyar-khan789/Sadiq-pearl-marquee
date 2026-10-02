import Link from "next/link";
import { AdminError, PageHeader, SlotStateText, StatusPill } from "@/components/admin/AdminUi";
import { OpsStatusPill } from "@/components/admin/OpsUi";
import { addDays } from "@/lib/booking/dates";
import { formatEventDate, formatPKR } from "@/lib/booking/format";
import { loadCalendarRange } from "@/lib/booking/operations-server";
import ViewSwitch from "./ViewSwitch";

/**
 * Week / day views of the SAME calendar (Phase 8): availability from the
 * booking engine, plus the operational status of each confirmed event.
 * No separate event database — everything is read from the bookings.
 */
export default async function CalendarRangeView({ view, start, today }: { view: "week" | "day"; start: string; today: string }) {
  const days = view === "week" ? 7 : 1;
  const result = await loadCalendarRange(start, days);
  const step = view === "week" ? 7 : 1;
  const title =
    view === "week" ? `Week of ${formatEventDate(start, "short")}` : formatEventDate(start);
  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" subtitle={view === "week" ? "Events and preparation status for the week." : "Everything happening on one day."} />
      <ViewSwitch current={view} date={start} />
      <nav aria-label={view === "week" ? "Week" : "Day"} className="flex items-center justify-between gap-2">
        <Link href={`/admin/calendar?view=${view}&date=${addDays(start, -step)}`} className="btn btn-outline btn-sm whitespace-nowrap" aria-label={`Previous ${view}`}>← Prev</Link>
        <h2 className="text-center text-base font-semibold text-ink sm:text-lg">{title}</h2>
        <Link href={`/admin/calendar?view=${view}&date=${addDays(start, step)}`} className="btn btn-outline btn-sm whitespace-nowrap" aria-label={`Next ${view}`}>Next →</Link>
      </nav>
      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/calendar?view=${view}&date=${start}`} />
      ) : (
        <ol className="space-y-3" aria-label={title}>
          {result.data.days.map((day) => (
            <li key={day.date} className={`rounded-2xl border p-3 sm:p-4 ${day.date === today ? "border-gold bg-gold-pale/20" : "border-line bg-surface"}`}>
              <h3 className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {view === "week" ? (
                  <Link href={`/admin/calendar?view=day&date=${day.date}`} className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">{formatEventDate(day.date)}</Link>
                ) : (
                  formatEventDate(day.date)
                )}
                {day.date === today && <span className="rounded bg-gold-pale px-1.5 text-xs">Today</span>}
              </h3>
              <ul className="mt-2 grid gap-2 md:grid-cols-2">
                {result.data.slots.map((slot) => {
                  const state = day.slots.find((x) => x.slotId === slot.id)?.state ?? null;
                  const evs = result.data.events[`${day.date}|${slot.id}`] ?? [];
                  const req = result.data.requests[`${day.date}|${slot.id}`];
                  return (
                    <li key={slot.id} className="rounded-xl border border-line p-3 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{slot.label}</span>
                        <SlotStateText state={state} />
                      </p>
                      {evs.length ? (
                        evs.map((ev) => (
                          <div key={ev.bookingId} className="mt-2 space-y-1">
                            <p className="font-semibold text-ink">{ev.customerName || "—"}</p>
                            <p className="text-ink-soft">
                              {ev.eventTypeLabel} · {ev.guestCount.toLocaleString("en-US")} guests · {ev.hallName} · <span className="font-mono">{ev.reference}</span>
                            </p>
                            <p className="flex flex-wrap gap-1.5">
                              <StatusPill status={ev.bookingStatus} />
                              <OpsStatusPill status={ev.opsStatus} />
                            </p>
                            <p className="text-xs text-ink-muted">
                              {ev.checklistTotal ? `Checklist ${ev.checklistDone}/${ev.checklistTotal}` : "Checklist not started"}
                              {ev.remaining !== null && ev.remaining > 0 && ` · remaining ${formatPKR(ev.remaining)}`}
                            </p>
                            <Link href={`/admin/events/${ev.bookingId}`} className="inline-flex min-h-[44px] items-center font-semibold text-gold underline-offset-2 hover:underline">
                              Open event sheet →
                            </Link>
                          </div>
                        ))
                      ) : req ? (
                        <p className="mt-2 flex flex-wrap items-center gap-2">
                          <Link href={`/admin/bookings/${req.bookingId}`} className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">{req.customerName || "Request"} · <span className="font-mono">{req.reference}</span></Link>
                          <StatusPill status={req.status} />
                        </p>
                      ) : (
                        <p className="mt-2 text-ink-muted">No event.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
