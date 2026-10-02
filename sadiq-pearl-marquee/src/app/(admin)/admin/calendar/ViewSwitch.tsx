import Link from "next/link";

/** Month / week / day switch of the one admin calendar. */
export default function ViewSwitch({ current, date }: { current: "month" | "week" | "day"; date: string }) {
  const href = (v: string) => (v === "month" ? `/admin/calendar?month=${date.slice(0, 7)}&date=${date}` : `/admin/calendar?view=${v}&date=${date}`);
  return (
    <nav aria-label="Calendar view" className="flex gap-2">
      {(["month", "week", "day"] as const).map((v) => (
        <Link key={v} href={href(v)} aria-current={current === v ? "page" : undefined} className={`btn btn-sm ${current === v ? "btn-primary" : "btn-outline"}`}>
          {v === "month" ? "Month" : v === "week" ? "Week" : "Day"}
        </Link>
      ))}
    </nav>
  );
}
