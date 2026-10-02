import { OPS_STATUS_LABELS, type OpsStatus } from "@/lib/booking/operations-model";
import Icon, { type IconName } from "../Icon";

// Operational status = icon + text, never colour alone.
const OPS_STYLE: Record<OpsStatus, { icon: IconName; cls: string }> = {
  not_started: { icon: "clock", cls: "border-line-strong bg-surface-low text-ink-soft" },
  preparing: { icon: "light", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  ready: { icon: "check", cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  in_progress: { icon: "play", cls: "border-sky-300 bg-sky-50 text-sky-900" },
  completed: { icon: "star", cls: "border-line-strong bg-surface-mid text-ink" },
};

export function OpsStatusPill({ status }: { status: OpsStatus }) {
  const s = OPS_STYLE[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      <Icon name={s.icon} className="h-3.5 w-3.5" />
      <span className="sr-only">Operations: </span>
      {OPS_STATUS_LABELS[status]}
    </span>
  );
}
