import { formatPKR } from "@/lib/booking/format";
import type { Quote } from "@/lib/booking/pricing";

/**
 * Shows a quote from the one pricing engine: the full breakdown when every
 * needed price is configured, otherwise "Pricing pending" (never a guess).
 */
export default function PriceBreakdown({ quote, estimate = false }: { quote: Quote; estimate?: boolean }) {
  if (quote.status === "unpriced") {
    return (
      <div className="rounded-2xl bg-surface-low px-4 py-3 text-sm leading-relaxed text-ink-soft">
        <p className="font-semibold text-ink">Pricing pending</p>
        <p className="mt-1">Our team will confirm the price. No amount is shown until all prices are set.</p>
      </div>
    );
  }
  const s = quote.snapshot;
  const row = (label: string, value: string, strong = false) => (
    <div key={label} className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "font-semibold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
  return (
    <div>
      <dl className="divide-y divide-line text-sm">
        {s.lines.map((l) =>
          row(l.quantity > 1 ? `${l.label} (${l.quantity.toLocaleString("en-US")} × ${formatPKR(l.unitAmount)})` : l.label, formatPKR(l.amount))
        )}
        {row("Subtotal", formatPKR(s.subtotal))}
        {(s.discount ?? 0) > 0 && row(s.discountLabel ?? "Discount", `− ${formatPKR(s.discount ?? 0)}`)}
        {s.serviceCharge > 0 && row("Service charge", formatPKR(s.serviceCharge))}
        {row(estimate ? "Estimated total" : "Total", formatPKR(s.total), true)}
        {s.advanceRequired !== null && row("Advance required", formatPKR(s.advanceRequired))}
        {s.advanceRequired !== null && row("Remaining after advance", formatPKR(s.total - s.advanceRequired))}
      </dl>
      {estimate && (
        <p className="mt-2 text-xs text-ink-muted">
          Estimate from current prices. The final price is calculated when your request is saved and confirmed by our team.
        </p>
      )}
    </div>
  );
}
