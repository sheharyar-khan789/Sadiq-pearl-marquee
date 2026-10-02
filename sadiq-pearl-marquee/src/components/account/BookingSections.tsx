import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import type { CustomerPaymentView, QuotationView } from "@/lib/booking/finance-view";
import { FINANCIAL_STATUS_LABELS, financialSummary } from "@/lib/booking/finance-model";
import type { CustomerBookingView } from "@/lib/booking/portal";
import Icon from "../Icon";

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-8">
      <h2 id={id} className="font-display text-[1.75rem] leading-tight text-ink">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Real pricing only; a clear "pending" state when the booking has no price yet. */
export function PricingSummary({ booking }: { booking: CustomerBookingView }) {
  const { pricing, payment } = booking;
  if (!pricing) {
    return (
      <div className="rounded-2xl bg-surface-low px-5 py-4 text-[0.9375rem] leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Pricing pending</p>
        <p className="mt-1">
          Our team will confirm the price for this booking with you. No amounts are shown until they are confirmed.
        </p>
      </div>
    );
  }
  const row = (label: string, value: string, strong = false) => (
    <div key={label} className="flex items-baseline justify-between gap-4 py-2">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-display text-2xl text-ink" : "font-semibold text-ink"}`}>{value}</dd>
    </div>
  );
  const lineLabel = (code: string, label: string, qty: number, unit: number) =>
    qty > 1 ? `${label} (${qty.toLocaleString("en-US")} × ${formatPKR(unit)})` : label;
  return (
    <dl className="divide-y divide-line text-[0.9375rem]">
      {pricing.lines.map((l) => row(lineLabel(l.code, l.label, l.quantity, l.unitAmount), formatPKR(l.amount)))}
      {row("Subtotal", formatPKR(pricing.subtotal))}
      {pricing.discount > 0 && row(pricing.discountLabel, `− ${formatPKR(pricing.discount)}`)}
      {pricing.serviceCharge > 0 && row("Service charge", formatPKR(pricing.serviceCharge))}
      {row("Total", formatPKR(pricing.total), true)}
      {payment.advanceRequired !== null && row("Advance required", formatPKR(payment.advanceRequired))}
      {row("Paid", formatPKR(payment.advanceReceived))}
      {payment.balanceDue !== null && row("Remaining balance", formatPKR(payment.balanceDue), true)}
      {row(
        "Payment status",
        FINANCIAL_STATUS_LABELS[financialSummary(booking).status]
      )}
    </dl>
  );
}

/** Only steps that actually happened (stored timestamps), oldest first. */
export function BookingTimeline({ booking }: { booking: CustomerBookingView }) {
  return (
    <>
      <ol className="relative space-y-5 border-l border-line-strong/50 pl-6">
        {booking.timeline.map((step, i) => {
          const last = i === booking.timeline.length - 1;
          return (
            <li key={step.key} className="relative">
              <span
                aria-hidden="true"
                className={`absolute -left-[32.5px] top-0.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                  last ? "border-gold bg-gold" : "border-line-strong bg-surface"
                }`}
              />
              <p className="font-semibold text-ink">{step.label}</p>
              <p className="text-sm text-ink-muted">
                <time dateTime={step.at}>{formatTimestamp(step.at)}</time>
              </p>
            </li>
          );
        })}
      </ol>
      {(booking.status === "pending" || booking.status === "under_review") && (
        <p className="mt-5 flex gap-2 text-sm leading-relaxed text-ink-soft">
          <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          {booking.holdLapsed
            ? "This request is still waiting for our team. The date is no longer held for you in the meantime, so we'll confirm its availability when we contact you."
            : "This is a request, not a confirmed booking yet. Our team will contact you to confirm."}
        </p>
      )}
    </>
  );
}

/** Issued quotations and payment receipts (Phase 7). Read-only; PDFs come from the stored documents. */
export function PaymentsAndDocuments({ payments, quotations }: { payments: CustomerPaymentView[]; quotations: QuotationView[] }) {
  const link = "inline-flex min-h-[44px] items-center font-semibold text-gold underline-offset-2 hover:underline";
  return (
    <div className="space-y-6 text-[0.9375rem]">
      <div>
        <h3 className="font-semibold text-ink">Quotations</h3>
        {quotations.length === 0 ? (
          <p className="mt-1 leading-relaxed text-ink-soft">No quotation has been issued for this booking yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {quotations.map((q) => (
              <li key={q.quotationId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={q.status === "issued" ? "font-semibold text-ink" : "text-ink-muted"}>
                    {q.number} · {formatPKR(q.total)}
                    {q.status === "superseded" && " · replaced by a newer quotation"}
                  </p>
                  {q.issuedAt && <p className="text-sm text-ink-muted">Issued {formatTimestamp(q.issuedAt)}</p>}
                  {q.status === "issued" && !q.matchesBooking && (
                    <p className="text-sm text-amber-900">Your booking has changed since this quotation. Our team will send an updated one.</p>
                  )}
                </div>
                <a href={`/api/documents/quotations/${q.quotationId}`} target="_blank" rel="noopener" className={link}>
                  Download PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-ink">Payments &amp; receipts</h3>
        {payments.length === 0 ? (
          <p className="mt-1 leading-relaxed text-ink-soft">
            No payments recorded yet. When our team records a payment for this booking, its receipt will appear here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {payments.map((p) => (
              <li key={p.paymentId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={p.status === "voided" ? "text-ink-muted line-through" : "font-semibold text-ink"}>
                    {formatPKR(p.amount)} · {p.methodLabel} · {formatEventDate(p.paidOn, "short")}
                  </p>
                  <p className="text-sm text-ink-muted">
                    Receipt {p.receiptNumber}
                    {p.status === "voided" ? " · cancelled (void) — not counted" : ` · remaining after this payment ${formatPKR(p.remainingAfter)}`}
                  </p>
                </div>
                <a href={`/api/documents/receipts/${p.paymentId}`} target="_blank" rel="noopener" className={link}>
                  Receipt PDF
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
