// Display formatting shared by server and client components.
import { BUSINESS_TIME_ZONE } from "./dates.ts";

/** "Tuesday, 20 October 2026" for a YYYY-MM-DD event date (no time-zone shift). */
export function formatEventDate(date: string, style: "long" | "short" = "long"): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "3 Oct 2026, 4:05 pm" in the venue's time zone, for stored timestamps. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  });
}

export function formatPKR(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}
