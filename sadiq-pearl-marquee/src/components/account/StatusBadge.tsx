import type { BookingStatus } from "@/lib/booking/status";
import { STATUS_LABELS } from "@/lib/booking/status";
import Icon, { type IconName } from "../Icon";

// Status is always shown as text + icon, never by colour alone.
const STYLE: Record<BookingStatus, { icon: IconName; className: string }> = {
  pending: { icon: "clock", className: "border-amber-200 bg-amber-50 text-amber-900" },
  under_review: { icon: "clock", className: "border-amber-200 bg-amber-50 text-amber-900" },
  confirmed: { icon: "check", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  completed: { icon: "star", className: "border-line bg-surface-low text-ink" },
  cancelled: { icon: "close", className: "border-line bg-surface-mid text-ink-soft" },
  rejected: { icon: "close", className: "border-line bg-surface-mid text-ink-soft" },
  expired: { icon: "alert", className: "border-line bg-surface-mid text-ink-soft" },
};

export default function StatusBadge({ status }: { status: BookingStatus }) {
  const style = STYLE[status] ?? STYLE.pending;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.className}`}
    >
      <Icon name={style.icon} className="h-3.5 w-3.5" />
      <span>
        <span className="sr-only">Status: </span>
        {STATUS_LABELS[status] ?? status}
      </span>
    </span>
  );
}
