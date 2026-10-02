import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, PageHeader, Panel, SlotStateText, StatusPill } from "@/components/admin/AdminUi";
import { OpsStatusPill } from "@/components/admin/OpsUi";
import CalendarRangeView from "./CalendarRangeView";
import ViewSwitch from "./ViewSwitch";
import { loadCalendar } from "@/lib/booking/admin-server";
import type { SlotState } from "@/lib/booking/availability";
import { addDays, businessToday, isIsoDate } from "@/lib/booking/dates";
import { formatEventDate } from "@/lib/booking/format";

export const metadata: Metadata = { title: "Calendar" };

// Symbols so state never relies on colour alone.
const MARK: Record<SlotState, { sym: string; cls: string; word: string }> = {
  available: { sym: "○", cls: "text-emerald-800", word: "free" },
  held: { sym: "◐", cls: "text-amber-800", word: "on hold" },
  booked: { sym: "●", cls: "text-ink", word: "booked" },
  closed: { sym: "–", cls: "text-ink-muted", word: "closed" },
};

const shift = (month: string, delta: number) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
};

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = businessToday(new Date());
  // Phase 8: week and day views (operational); month view below is unchanged.
  const view = params.view === "week" || params.view === "day" ? params.view : "month";
  if (view !== "month") {
    const raw = typeof params.date === "string" && isIsoDate(params.date) ? params.date : today;
    // Weeks start on Monday (venue calendar); the day view shows one date.
    const weekday = (new Date(`${raw}T00:00:00Z`).getUTCDay() + 6) % 7;
    const start = view === "week" ? addDays(raw, -weekday) : raw;
    return <CalendarRangeView view={view} start={start} today={today} />;
  }
  const month = typeof params.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : today.slice(0, 7);
  const date = typeof params.date === "string" && isIsoDate(params.date) && params.date.startsWith(month) ? params.date : null;
  const result = await loadCalendar(month);
  const monthName = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-5">
      <PageHeader title="Calendar" subtitle="Live slot availability (same engine as the public booking page)." />
      <ViewSwitch current="month" date={date ?? today} />
      <nav aria-label="Month" className="flex items-center justify-between gap-2">
        <Link href={`/admin/calendar?month=${shift(month, -1)}`} aria-label="Previous month" className="btn btn-outline btn-sm whitespace-nowrap">← Prev</Link>
        <h2 className="text-center text-base font-semibold text-ink sm:text-lg">{monthName}</h2>
        <Link href={`/admin/calendar?month=${shift(month, 1)}`} aria-label="Next month" className="btn btn-outline btn-sm whitespace-nowrap">Next →</Link>
      </nav>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref={`/admin/calendar?month=${month}`} />
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-ink-muted" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <ol className="grid grid-cols-7 gap-1" aria-label={`Days in ${monthName}`}>
            {Array.from({ length: (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
              <li key={`b${i}`} aria-hidden="true" />
            ))}
            {result.data.days.map((d) => {
              const selected = d.date === date;
              const label = `${formatEventDate(d.date)}: ${d.slots.map((s) => `${result.data.slots.find((x) => x.id === s.slotId)?.label} ${MARK[s.state].word}`).join(", ")}`;
              return (
                <li key={d.date}>
                  <Link
                    href={`/admin/calendar?month=${month}&date=${d.date}`}
                    aria-label={label}
                    aria-current={selected ? "date" : undefined}
                    className={`flex min-h-[52px] flex-col rounded-lg border p-1 text-left text-xs sm:min-h-[72px] sm:p-2 ${
                      selected ? "border-espresso ring-2 ring-espresso" : "border-line bg-surface hover:border-ink/40"
                    } ${d.date === today ? "bg-gold-pale/40" : ""}`}
                  >
                    <span className="font-semibold text-ink">{Number(d.date.slice(8))}</span>
                    <span className="mt-auto flex flex-col leading-tight">
                      {d.slots.map((s) => (
                        <span key={s.slotId} className={MARK[s.state].cls}>
                          <span aria-hidden="true">{result.data.slots.find((x) => x.id === s.slotId)?.label.charAt(0)} {MARK[s.state].sym}</span>
                        </span>
                      ))}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-ink-muted">D = Day, N = Night · ○ free · ◐ on hold (pending / under review) · ● booked · – closed (past)</p>

          {date && (
            <Panel title={formatEventDate(date)}>
              <ul className="grid gap-3 md:grid-cols-2">
                {result.data.slots.map((s) => {
                  const day = result.data.days.find((x) => x.date === date);
                  const state = day?.slots.find((x) => x.slotId === s.id)?.state ?? null;
                  const b = result.data.bookings[`${date}|${s.id}`];
                  return (
                    <li key={s.id} className="rounded-xl border border-line p-3 text-sm">
                      <p className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink">{s.label}</span>
                        <SlotStateText state={state} />
                      </p>
                      {b && state !== "available" ? (
                        <Link href={`/admin/bookings/${b.bookingId}`} className="mt-2 block rounded-lg bg-surface-low p-2 hover:bg-surface-mid">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{b.customerName || "—"}</span>
                            <StatusPill status={b.status} lapsed={b.holdLapsed} />
                          </span>
                          <span className="block text-ink-soft">
                            {b.eventTypeLabel} · {b.guestCount.toLocaleString("en-US")} guests · <span className="font-mono">{b.reference}</span>
                          </span>
                          {(b.status === "confirmed" || b.status === "completed") && (
                            <span className="mt-1 flex flex-wrap items-center gap-2">
                              <OpsStatusPill status={result.data.ops[b.bookingId] ?? "not_started"} />
                            </span>
                          )}
                        </Link>
                      ) : (
                        <p className="mt-2 text-ink-muted">No booking in this slot.</p>
                      )}
                      {b && state !== "available" && (b.status === "confirmed" || b.status === "completed") && (
                        <Link href={`/admin/events/${b.bookingId}`} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-gold underline-offset-2 hover:underline">
                          Open event sheet →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

