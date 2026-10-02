"use client";

import { useId, useState } from "react";
import { FINANCIAL_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type FinancialSummary, type PaymentMethod } from "@/lib/booking/finance-model";
import type { AdminPaymentView, QuotationView } from "@/lib/booking/finance-view";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import { NoticeLine, useAdminAction } from "./BookingActions";
import ConfirmDialog from "./ConfirmDialog";

const inputClass =
  "block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-[0.9375rem] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40 aria-[invalid=true]:border-red-600";
const labelClass = "mb-1 block text-[0.8125rem] font-semibold text-ink";

function newKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const STATUS_TONE: Record<FinancialSummary["status"], string> = {
  pricing_pending: "border-line bg-surface-low text-ink-soft",
  unpaid: "border-amber-300 bg-amber-50 text-amber-900",
  partially_paid: "border-sky-300 bg-sky-50 text-sky-900",
  paid: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

export function FinancialStatusPill({ status }: { status: FinancialSummary["status"] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>
      {FINANCIAL_STATUS_LABELS[status]}
    </span>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 py-1.5 ${strong ? "font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-ink-soft"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

/** Financial summary, price calculation, payments and quotations of one booking (Super Admin). */
export default function FinancePanel({
  bookingId,
  updatedAt,
  today,
  summary,
  open,
  priceCheck,
  payments,
  quotations,
}: {
  bookingId: string;
  updatedAt: string;
  today: string;
  summary: FinancialSummary;
  /** Whether the booking can still take payments / quotations (not cancelled, rejected or expired). */
  open: boolean;
  priceCheck: { status: "priced"; total: number } | { status: "unpriced"; missing: string[] } | null;
  payments: AdminPaymentView[];
  quotations: QuotationView[];
}) {
  const uid = useId();
  const action = useAdminAction();
  const [confirmPrice, setConfirmPrice] = useState(false);

  // Payment form
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidOn, setPaidOn] = useState(today);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [requestKey, setRequestKey] = useState(newKey);
  const [confirmPay, setConfirmPay] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  // Void / quotation actions
  const [voiding, setVoiding] = useState<AdminPaymentView | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [quoteAction, setQuoteAction] = useState<{ kind: "issue" | "discard"; q: QuotationView } | null>(null);

  const remaining = summary.remaining;
  const amountNumber = Number(amount);
  const canPay = open && summary.total !== null && remaining !== null && remaining > 0;

  const reviewPayment = () => {
    if (!/^\d+$/.test(amount.trim()) || amountNumber <= 0) return setAmountError("Enter the amount received in whole rupees (more than 0).");
    if (remaining !== null && amountNumber > remaining) return setAmountError(`That is more than the remaining balance (${formatPKR(remaining)}).`);
    setAmountError(null);
    setConfirmPay(true);
  };

  const submitPayment = async () => {
    const ok = await action.send(
      `/api/admin/bookings/${bookingId}/payments`,
      { amount: amountNumber, method, paidOn, reference: reference.trim(), notes: notes.trim(), requestKey },
      `Payment of ${formatPKR(amountNumber)} recorded. Its receipt is in the payment history.`
    );
    setConfirmPay(false);
    if (ok) {
      setAmount("");
      setReference("");
      setNotes("");
      setRequestKey(newKey()); // a new form = a new payment
    }
  };

  const drafts = quotations.filter((q) => q.status === "draft");

  return (
    <div className="space-y-5">
      <NoticeLine notice={action.notice} />

      {/* ---------- summary */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <FinancialStatusPill status={summary.status} />
          {summary.advanceOutstanding !== null && summary.advanceOutstanding > 0 && (
            <span className="text-xs text-ink-muted">Advance still due: {formatPKR(summary.advanceOutstanding)}</span>
          )}
        </div>
        {summary.total === null ? (
          <div className="space-y-2 text-sm">
            <p className="text-ink-soft">This booking has no price yet, so payments and quotations can&rsquo;t be made.</p>
            {priceCheck?.status === "priced" && open && (
              <>
                <p className="text-ink">With the current price list the total would be <strong>{formatPKR(priceCheck.total)}</strong>.</p>
                <button type="button" className="btn btn-primary btn-sm" disabled={action.busy} onClick={() => setConfirmPrice(true)}>
                  Calculate &amp; save price
                </button>
              </>
            )}
            {priceCheck?.status === "unpriced" && (
              <p className="text-ink-muted">
                Missing prices in Settings: {priceCheck.missing.join(", ")}.
              </p>
            )}
          </div>
        ) : (
          <dl className="divide-y divide-line text-sm">
            <Row label="Booking total" value={formatPKR(summary.total)} strong />
            <Row label="Required advance" value={summary.requiredAdvance === null ? "Not set" : formatPKR(summary.requiredAdvance)} />
            <Row label="Paid (recorded payments)" value={formatPKR(summary.paid)} />
            <Row label="Remaining" value={formatPKR(remaining ?? 0)} strong />
          </dl>
        )}
      </div>

      {/* ---------- record a payment */}
      {canPay && (
        <form
          className="space-y-3 rounded-xl border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            reviewPayment();
          }}
          noValidate
        >
          <h3 className="text-sm font-semibold text-ink">Record a payment received</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-amount`} className={labelClass}>Amount (Rs)</label>
              <input
                id={`${uid}-amount`}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={amountError ? true : undefined}
                aria-describedby={amountError ? `${uid}-amount-err` : undefined}
                className={inputClass}
                placeholder={`Up to ${formatPKR(remaining ?? 0)}`}
              />
              {amountError && <p id={`${uid}-amount-err`} className="mt-1 text-xs text-red-800">{amountError}</p>}
            </div>
            <div>
              <label htmlFor={`${uid}-method`} className={labelClass}>Method</label>
              <select id={`${uid}-method`} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-date`} className={labelClass}>Date received</label>
              <input id={`${uid}-date`} type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`${uid}-ref`} className={labelClass}>Reference (optional)</label>
              <input id={`${uid}-ref`} value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} className={inputClass} placeholder="Cheque / transfer no." />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-notes`} className={labelClass}>Internal note (optional)</label>
            <input id={`${uid}-notes`} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={action.busy}>
            Review payment…
          </button>
        </form>
      )}
      {!open && summary.total !== null && (
        <p className="text-sm text-ink-muted">This booking is no longer active, so no new payments or quotations can be made. Existing records stay available.</p>
      )}

      {/* ---------- payment history */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Payment history</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-muted">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {[...payments].reverse().map((p) => (
              <li key={p.paymentId} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={p.status === "voided" ? "text-ink-muted line-through" : "font-semibold text-ink"}>
                    {formatPKR(p.amount)} · {p.methodLabel} · {formatEventDate(p.paidOn, "short")}
                  </p>
                  <p className="break-words text-xs text-ink-muted">
                    Receipt {p.receiptNumber} · recorded {formatTimestamp(p.recordedAt)} by {p.recordedBy}
                    {p.reference && ` · ref ${p.reference}`}
                  </p>
                  {p.notes && <p className="break-words text-xs text-ink-muted">Note: {p.notes}</p>}
                  {p.status === "voided" && (
                    <p className="break-words text-xs font-semibold text-red-800">
                      VOID · {p.voidedAt && formatTimestamp(p.voidedAt)} · {p.voidedBy} · {p.voidReason}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a href={`/api/documents/receipts/${p.paymentId}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
                    Receipt PDF
                  </a>
                  {p.status === "recorded" && (
                    <button type="button" className="btn btn-sm border border-red-300 text-red-800 hover:bg-red-50" disabled={action.busy} onClick={() => { setVoidReason(""); setVoiding(p); }}>
                      Void
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- quotations */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Quotations</h3>
          {open && summary.total !== null && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={action.busy}
              onClick={() => void action.send(`/api/admin/bookings/${bookingId}/quotations`, { expectedUpdatedAt: updatedAt }, "Quotation draft created. Check the PDF, then issue it to the customer.")}
            >
              {drafts.length ? "New draft (replaces the current draft)" : "Generate quotation draft"}
            </button>
          )}
        </div>
        {quotations.length === 0 ? (
          <p className="text-sm text-ink-muted">No quotations yet.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {quotations.map((q) => (
              <li key={q.quotationId} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={q.status === "discarded" || q.status === "superseded" ? "text-ink-muted" : "font-semibold text-ink"}>
                    {q.number ?? "Draft"} · {q.statusLabel} · {formatPKR(q.total)}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {q.issuedAt ? `Issued ${formatTimestamp(q.issuedAt)}` : `Created ${formatTimestamp(q.createdAt)}`}
                  </p>
                  {!q.matchesBooking && (q.status === "issued" || q.status === "draft") && (
                    <p className="text-xs font-semibold text-amber-900">The booking&rsquo;s price has changed since this was made. Generate a new draft.</p>
                  )}
                </div>
                {q.status !== "discarded" && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a href={`/api/documents/quotations/${q.quotationId}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">
                      PDF
                    </a>
                    {q.status === "draft" && (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" disabled={action.busy || !q.matchesBooking || !open} onClick={() => setQuoteAction({ kind: "issue", q })}>
                          Issue
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" disabled={action.busy} onClick={() => setQuoteAction({ kind: "discard", q })}>
                          Discard
                        </button>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---------- dialogs */}
      <ConfirmDialog
        open={confirmPrice}
        title="Calculate and save the price?"
        confirmLabel="Save price"
        busy={action.busy}
        onClose={() => setConfirmPrice(false)}
        onConfirm={async () => {
          await action.send(`/api/admin/bookings/${bookingId}/price`, { expectedUpdatedAt: updatedAt }, "Price calculated and saved.");
          setConfirmPrice(false);
        }}
      >
        <p>The server calculates the price with the current price list and stores it with this booking. It will not change if prices are updated later.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmPay}
        title={`Record ${formatPKR(amountNumber || 0)}?`}
        confirmLabel="Record payment"
        busy={action.busy}
        onClose={() => setConfirmPay(false)}
        onConfirm={submitPayment}
      >
        <p>
          {PAYMENT_METHOD_LABELS[method]} received on {paidOn ? formatEventDate(paidOn, "short") : "—"}
          {reference.trim() && `, reference ${reference.trim()}`}.
        </p>
        {remaining !== null && <p>Remaining after this payment: <strong>{formatPKR(Math.max(0, remaining - (amountNumber || 0)))}</strong> (re-checked by the server).</p>}
        <p>A numbered receipt is created. Payments can&rsquo;t be edited later — only voided with a reason.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={voiding !== null}
        title={voiding ? `Void payment of ${formatPKR(voiding.amount)}?` : ""}
        confirmLabel="Void payment"
        danger
        busy={action.busy}
        onClose={() => setVoiding(null)}
        onConfirm={async () => {
          if (!voiding) return;
          if (voidReason.trim().length < 3) {
            action.setNotice({ tone: "error", message: "Please give a reason for voiding (at least 3 characters)." });
            setVoiding(null);
            return;
          }
          await action.send(`/api/admin/payments/${voiding.paymentId}/void`, { reason: voidReason.trim() }, "Payment voided. The totals were recalculated.");
          setVoiding(null);
        }}
        reason={{ value: voidReason, onChange: setVoidReason, label: "Reason (required — kept on the record and in the audit trail)" }}
      >
        <p>The payment and receipt {voiding?.receiptNumber} stay on record, marked VOID, and no longer count towards the booking. This can&rsquo;t be undone; record a new payment if needed.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={quoteAction !== null}
        title={quoteAction?.kind === "issue" ? "Issue this quotation to the customer?" : "Discard this draft?"}
        confirmLabel={quoteAction?.kind === "issue" ? "Issue quotation" : "Discard draft"}
        danger={quoteAction?.kind === "discard"}
        busy={action.busy}
        onClose={() => setQuoteAction(null)}
        onConfirm={async () => {
          if (!quoteAction) return;
          await action.send(
            `/api/admin/quotations/${quoteAction.q.quotationId}/${quoteAction.kind}`,
            {},
            quoteAction.kind === "issue" ? "Quotation issued. The customer can now see and download it." : "Draft discarded."
          );
          setQuoteAction(null);
        }}
      >
        {quoteAction?.kind === "issue" ? (
          <p>It gets a permanent quotation number and becomes visible in the customer&rsquo;s account. Any previously issued quotation is marked superseded. Issued quotations are never changed.</p>
        ) : (
          <p>The draft was never shown to the customer.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
