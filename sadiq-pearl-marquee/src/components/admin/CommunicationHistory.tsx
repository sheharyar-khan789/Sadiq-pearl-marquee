import Link from "next/link";
import type { CommunicationRow } from "@/lib/booking/communications-server";
import { formatTimestamp } from "@/lib/booking/format";
import { NOTIFICATION_TYPE_LABELS, WHATSAPP_TEMPLATE_LABELS, type NotificationType, type WhatsAppTemplate } from "@/lib/booking/notifications";

/** What each status actually means — nothing beyond what the system can prove. */
const STATUS_TEXT: Record<CommunicationRow["status"], string> = {
  created: "In-app · not yet read",
  read: "In-app · read by customer",
  initiated: "WhatsApp opened by staff (delivery not tracked)",
};

export function typeLabel(r: Pick<CommunicationRow, "kind" | "type">) {
  return r.kind === "notification" ? NOTIFICATION_TYPE_LABELS[r.type as NotificationType] ?? r.type : WHATSAPP_TEMPLATE_LABELS[r.type as WhatsAppTemplate] ?? r.type;
}

export default function CommunicationHistory({ rows, showBooking = false }: { rows: CommunicationRow[]; showBooking?: boolean }) {
  if (!rows.length) return <p className="text-sm text-ink-muted">No communication recorded yet.</p>;
  return (
    <ul className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={`${r.kind}-${r.id}`} className="py-2.5">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs font-semibold text-ink-soft">{r.kind === "notification" ? "In-app" : "WhatsApp"}</span>
            <span className="font-semibold text-ink">{typeLabel(r)}</span>
            <span className="text-ink-muted">· {formatTimestamp(r.at)}</span>
          </p>
          <p className="mt-0.5 break-words text-ink-soft">
            {r.recipient}
            {r.title && ` — ${r.title}`}
          </p>
          <p className="text-xs text-ink-muted">
            {STATUS_TEXT[r.status]}
            {r.by && ` · by ${r.by}`}
            {showBooking && r.bookingId && (
              <>
                {" · "}
                <Link href={`/admin/bookings/${r.bookingId}`} className="inline-flex min-h-[44px] items-center font-mono underline-offset-2 hover:underline">
                  SP-{r.bookingId.slice(-8).toUpperCase()}
                </Link>
              </>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}
