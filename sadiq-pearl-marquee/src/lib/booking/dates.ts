// Calendar dates in the venue's own time zone. Event dates are plain
// "YYYY-MM-DD" strings (no time, no zone), compared as strings; "today" is
// always computed in the business time zone, never the browser's or UTC.

/**
 * REQUIRES CONFIRMATION — derived from the confirmed address (Sarai Alamgir,
 * Pakistan). Pakistan uses a single zone, UTC+5, without daylight saving.
 */
export const BUSINESS_TIME_ZONE = "Asia/Karachi";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar date written exactly as YYYY-MM-DD. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  if (y < 2000 || y > 2999) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date at the venue, e.g. "2026-10-20". */
export function businessToday(now: Date): string {
  const parts = Object.fromEntries(dayFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
