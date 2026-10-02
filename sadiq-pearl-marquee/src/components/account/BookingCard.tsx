import Link from "next/link";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import type { CustomerBookingView } from "@/lib/booking/portal";
import Icon from "../Icon";
import StatusBadge from "./StatusBadge";

/** One booking in the customer's list. The whole card links to its details. */
export default function BookingCard({
  booking,
  openRequestTypes = [],
  headingLevel = "h3",
}: {
  booking: CustomerBookingView;
  openRequestTypes?: string[];
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  const b = booking;
  return (
    <article className="group relative rounded-3xl border border-line bg-surface p-5 shadow-soft transition-colors hover:border-line-strong/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold-container sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{b.eventTypeLabel}</p>
          <Heading className="mt-1.5 font-display text-2xl leading-tight text-ink">
            <Link
              href={`/account/bookings/${b.bookingId}`}
              className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
            >
              {formatEventDate(b.eventDate)}
            </Link>
          </Heading>
        </div>
        <StatusBadge status={b.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-ink-muted">Slot</dt>
          <dd className="font-semibold text-ink">{b.slotLabel}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-muted">Hall</dt>
          <dd className="break-words font-semibold text-ink">{b.hallName}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Guests</dt>
          <dd className="font-semibold text-ink">{b.guestCount.toLocaleString("en-US")}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Total</dt>
          <dd className="font-semibold text-ink">{b.pricing ? formatPKR(b.pricing.total) : "To be confirmed"}</dd>
        </div>
        {b.pricing && b.payment.balanceDue !== null && (
          <div>
            <dt className="text-ink-muted">Remaining</dt>
            <dd className="font-semibold text-ink">{formatPKR(b.payment.balanceDue)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-4 text-xs text-ink-muted">
        <span>
          Ref <span className="font-mono text-ink-soft">{b.reference}</span> · Requested {formatTimestamp(b.createdAt)}
        </span>
        {openRequestTypes.length > 0 && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-gold">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {openRequestTypes.includes("cancellation") ? "Cancellation requested" : "Change requested"}
          </span>
        )}
        <span aria-hidden="true" className="inline-flex items-center gap-1 font-semibold text-ink group-hover:text-gold">
          Details <Icon name="arrow" className="h-3.5 w-3.5" />
        </span>
      </div>
    </article>
  );
}
