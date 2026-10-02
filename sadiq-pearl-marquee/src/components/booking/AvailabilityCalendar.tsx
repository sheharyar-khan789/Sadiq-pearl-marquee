"use client";

import { useRef } from "react";
import type { DayAvailability } from "@/lib/booking/availability";
import Icon from "../Icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const monthName = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
export const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const STATUS_TEXT: Record<DayAvailability["status"], string> = {
  available: "available",
  partial: "one slot left",
  unavailable: "fully booked",
  past: "past date",
  closed: "not open for requests",
};

/** Month grid of dates, coloured by availability. Arrow keys move between dates. */
export default function AvailabilityCalendar({
  month,
  days,
  selected,
  onSelect,
  onMonthChange,
  canGoBack,
  canGoForward,
  loading,
}: {
  month: string; // YYYY-MM
  days: DayAvailability[] | null;
  selected: string | null;
  onSelect: (date: string) => void;
  onMonthChange: (delta: -1 | 1) => void;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const selectable = (d: DayAvailability) => d.status === "available" || d.status === "partial";
  const leadingBlanks = (new Date(`${month}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const firstSelectable = days?.find(selectable)?.date;
  const tabStop = days?.some((d) => d.date === selected && selectable(d)) ? selected : firstSelectable;

  const focusDate = (date: string) =>
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus();

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step || !days) return;
    e.preventDefault();
    for (let i = index + step; i >= 0 && i < days.length; i += step) {
      if (selectable(days[i])) return focusDate(days[i].date);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
          className="grid h-11 w-11 place-items-center rounded-full border border-line-strong/50 text-ink transition-colors hover:bg-surface-mid disabled:opacity-35"
        >
          <Icon name="prev" className="h-5 w-5" />
        </button>
        <h3 aria-live="polite" className="font-display text-2xl text-ink">
          {monthName(month)}
        </h3>
        <button
          type="button"
          onClick={() => onMonthChange(1)}
          disabled={!canGoForward}
          aria-label="Next month"
          className="grid h-11 w-11 place-items-center rounded-full border border-line-strong/50 text-ink transition-colors hover:bg-surface-mid disabled:opacity-35"
        >
          <Icon name="next" className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-muted" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>

      <div ref={gridRef} role="group" aria-label={`Dates in ${monthName(month)}`} aria-busy={loading || undefined} className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}
        {days
          ? days.map((d, index) => {
              const isSelected = d.date === selected;
              const canPick = selectable(d);
              const tone = isSelected
                ? "border-espresso bg-espresso text-surface"
                : d.status === "available"
                  ? "border-line bg-surface text-ink hover:border-ink/50"
                  : d.status === "partial"
                    ? "border-gold-container/60 bg-gold-pale/50 text-ink hover:border-ink/50"
                    : d.status === "unavailable"
                      ? "border-transparent bg-surface-mid text-ink-muted line-through"
                      : "border-transparent text-ink-muted/60";
              return (
                <button
                  key={d.date}
                  type="button"
                  data-date={d.date}
                  disabled={!canPick}
                  tabIndex={d.date === tabStop ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={`${longDate(d.date)}, ${STATUS_TEXT[d.status]}`}
                  onClick={() => onSelect(d.date)}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  className={`relative flex h-10 min-w-0 flex-col items-center justify-center rounded-xl border text-[0.9375rem] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed sm:aspect-square sm:h-auto ${tone}`}
                >
                  {Number(d.date.slice(8))}
                  {d.status === "partial" && !isSelected && (
                    <span aria-hidden="true" className="absolute bottom-1.5 h-1 w-1 rounded-full bg-gold" />
                  )}
                </button>
              );
            })
          : Array.from({ length: 30 }, (_, i) => (
              <span key={`sk-${i}`} aria-hidden="true" className="h-10 animate-pulse rounded-xl bg-surface-mid/70 sm:aspect-square sm:h-auto" />
            ))}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border border-line bg-surface" /> Available
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded border border-gold-container/60 bg-gold-pale/50" /> One slot left
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3.5 w-3.5 rounded bg-surface-mid" /> Fully booked
        </li>
      </ul>
    </div>
  );
}
