import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminNotesForm from "@/components/admin/AdminNotesForm";
import BookingActions from "@/components/admin/BookingActions";
import { AdminError, Empty, PageHeader, Panel, SlotStateText, StatusPill } from "@/components/admin/AdminUi";
import RequestDecision from "@/components/admin/RequestDecision";
import FinancePanel from "@/components/admin/FinancePanel";
import CommunicationHistory from "@/components/admin/CommunicationHistory";
import WhatsAppComposer, { type ComposerOption } from "@/components/admin/WhatsAppComposer";
import { loadBookingCommunications } from "@/lib/booking/communications-server";
import { normalizeWhatsAppNumber } from "@/lib/booking/whatsapp-messages";
import { financialSummary, financiallyOpen } from "@/lib/booking/finance-model";
import { toAdminPaymentView, toAdminQuotationViews } from "@/lib/booking/finance-view";
import { SOURCE_LABELS } from "@/lib/booking/admin-view";
import { loadBookingDetail } from "@/lib/booking/admin-server";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import { REQUEST_STATUS_LABELS } from "@/lib/booking/request-model";

export const metadata: Metadata = { title: "Booking" };

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex min-w-0 gap-2 sm:block">
          <dt className="shrink-0 text-ink-muted">{k}</dt>
          <dd className="min-w-0 break-words font-semibold text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const TIMELINE: [string, string][] = [
  ["submittedAt", "Submitted"],
  ["reviewedAt", "Under review"],
  ["confirmedAt", "Confirmed"],
  ["completedAt", "Completed"],
  ["cancelledAt", "Cancelled"],
  ["rejectedAt", "Rejected"],
  ["expiredAt", "Expired"],
];

export default async function AdminBookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const result = await loadBookingDetail(bookingId);
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Booking" />
        <AdminError reason={result.reason} retryHref={`/admin/bookings/${encodeURIComponent(bookingId)}`} />
      </>
    );
  }
  if (!result.data) notFound();
  const { booking: b, row, slotState, requests, audit, holdHours, payments, quotations, priceCheck, today } = result.data;
  const updatedAt = new Date(b.updatedAt).toISOString();
  // Phase 9: communication history + manual WhatsApp options built only from real records.
  const comms = await loadBookingCommunications(b.bookingId, b.customer.name || null);
  const waOptions: ComposerOption[] = [];
  if (b.status === "confirmed") waOptions.push({ key: "confirm", label: "Booking confirmation", template: "booking_confirmation" });
  if (b.status === "confirmed" && b.eventDate >= today) waOptions.push({ key: "reminder", label: "Event reminder", template: "event_reminder" });
  for (const q of quotations.filter((x) => x.status === "issued")) {
    waOptions.push({ key: `q-${q.quotationId}`, label: `Quotation ${q.quotationNumber}`, template: "quotation", quotationId: q.quotationId });
  }
  for (const p of [...payments].reverse().filter((x) => x.status === "recorded").slice(0, 5)) {
    waOptions.push({ key: `p-${p.paymentId}`, label: `Payment confirmation — receipt ${p.receipt.receiptNumber}`, template: "payment_confirmation", paymentId: p.paymentId });
  }
  waOptions.push({ key: "general", label: "General message about this booking", template: "general" });
  const phoneOk = normalizeWhatsAppNumber(b.customer.phone) !== null;
  const openRequests = requests.filter((r) => r.record.status === "open");
  const decided = requests.filter((r) => r.record.status !== "open");
  const timeline = TIMELINE.filter(([k]) => (b.timeline as unknown as Record<string, unknown>)[k]).map(([k, label]) => ({
    label,
    at: new Date((b.timeline as unknown as Record<string, Date>)[k]).toISOString(),
  }));

  return (
    <div className="space-y-5">
      <p>
        <Link href="/admin/bookings" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">
          ← Bookings
        </Link>
      </p>
      <PageHeader
        title={`${formatEventDate(b.eventDate)} · ${b.slotLabel}`}
        subtitle={`${row.reference} · ${SOURCE_LABELS[b.source]} · submitted ${formatTimestamp(row.createdAt)}`}
        action={<StatusPill status={b.status} lapsed={row.holdLapsed} />}
      />
      {(b.status === "confirmed" || b.status === "completed") && (
        <p>
          <Link href={`/admin/events/${b.bookingId}`} className="btn btn-outline btn-sm">
            Open event sheet (preparation, vendors, notes) →
          </Link>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Customer">
          <Facts
            items={[
              ["Name", b.customer.name || "—"],
              ["Phone", b.customer.phone || "—"],
              ["Email", b.customer.email ?? "—"],
              [
                "Account",
                b.customerId ? (
                  <Link href={`/admin/customers/${b.customerId}`} className="inline-flex min-h-[44px] items-center text-gold underline-offset-2 hover:underline">
                    Online account
                  </Link>
                ) : (
                  "Offline customer (no online account)"
                ),
              ],
            ]}
          />
        </Panel>

        <Panel title="Event">
          <Facts
            items={[
              ["Date", formatEventDate(b.eventDate)],
              ["Slot", <span key="s">{b.slotLabel} · <SlotStateText state={slotState} /></span>],
              ["Hall", b.hallName],
              ["Event type", b.eventTypeLabel],
              ["Guests", b.guestCount.toLocaleString("en-US")],
              ["Source", SOURCE_LABELS[b.source]],
            ]}
          />
          {row.holdLapsed && (
            <p className="mt-3 text-xs text-amber-900">This pending request&rsquo;s {holdHours}-hour hold has lapsed; it no longer blocks the slot. Confirming re-checks the slot.</p>
          )}
        </Panel>

        {b.services.length > 0 && (
          <Panel title="Services">
            <p className="text-sm text-ink">{b.services.map((s) => s.label).join(", ")}</p>
          </Panel>
        )}
        {b.package && (
          <Panel title="Package">
            <p className="text-sm text-ink">{b.package.name}</p>
          </Panel>
        )}
        {b.menuPreference && (
          <Panel title="Menu">
            <p className="text-sm text-ink">{b.menuPreference.title}</p>
          </Panel>
        )}

        <Panel title="Pricing">
          {b.pricing ? (
            <dl className="divide-y divide-line text-sm">
              {b.pricing.lines.map((l) => (
                <div key={l.code} className="flex justify-between gap-3 py-1.5">
                  <dt className="text-ink-soft">{l.label}{l.quantity > 1 ? ` (${l.quantity} × ${formatPKR(l.unitAmount)})` : ""}</dt>
                  <dd className="tabular-nums">{formatPKR(l.amount)}</dd>
                </div>
              ))}
              {(b.pricing.discount ?? 0) > 0 && (
                <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">{b.pricing.discountLabel ?? "Discount"}</dt><dd className="tabular-nums">− {formatPKR(b.pricing.discount ?? 0)}</dd></div>
              )}
              {b.pricing.serviceCharge > 0 && (
                <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">Service charge</dt><dd className="tabular-nums">{formatPKR(b.pricing.serviceCharge)}</dd></div>
              )}
              <div className="flex justify-between gap-3 py-1.5 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPKR(b.pricing.total)}</dd></div>
              {b.payment.advanceRequired !== null && <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">Advance required</dt><dd className="tabular-nums">{formatPKR(b.payment.advanceRequired)}</dd></div>}
              <p className="pt-2 text-xs text-ink-muted">Price list version {b.pricing.configVersion}</p>
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">Pricing pending — this booking has no stored price yet (see Payments &amp; quotations).</p>
          )}
        </Panel>

        <Panel title="Customer notes">
          {b.customerNotes ? <p className="whitespace-pre-line break-words text-sm text-ink">{b.customerNotes}</p> : <p className="text-sm text-ink-muted">None.</p>}
        </Panel>
      </div>

      <Panel title="Payments & quotations" id="finance">
        <FinancePanel
          bookingId={b.bookingId}
          updatedAt={updatedAt}
          today={today}
          summary={financialSummary(b)}
          open={financiallyOpen(b, new Date())}
          priceCheck={priceCheck}
          payments={payments.map(toAdminPaymentView)}
          quotations={toAdminQuotationViews(quotations, b)}
        />
      </Panel>

      <Panel title="Communication" id="communication">
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">WhatsApp the customer (manual)</h3>
            <WhatsAppComposer
              bookingId={b.bookingId}
              options={waOptions}
              recipientLabel={b.customer.name || "the customer"}
              unavailable={
                phoneOk ? null : `The phone number on this booking (${b.customer.phone || "none"}) isn't a usable WhatsApp number, so no WhatsApp link can be made.`
              }
            />
            <p className="mt-3 text-xs text-ink-muted">Automated WhatsApp, email and SMS delivery: not configured (no provider). In-app notifications are created automatically for customers with an online account.</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink">History</h3>
            {comms.ok ? <CommunicationHistory rows={comms.data} /> : <p role="alert" className="text-sm text-red-900">Communication history couldn&rsquo;t be loaded. Reload to try again.</p>}
          </div>
        </div>
      </Panel>

      <Panel title="Status actions">
        <BookingActions bookingId={b.bookingId} status={b.status} updatedAt={updatedAt} />
      </Panel>

      <Panel title="Change & cancellation requests" id="requests">
        {requests.length === 0 && <Empty>No requests from the customer.</Empty>}
        <div className="space-y-4">
          {openRequests.map(({ record, view, requestedSlotNow, financialAdjustment }) => (
            <article key={record.requestId} className="rounded-xl border border-amber-300 bg-amber-50/40 p-3">
              <h3 className="text-sm font-semibold text-ink">
                Open {record.type === "cancellation" ? "cancellation" : "change"} request · submitted {formatTimestamp(view.createdAt)}
              </h3>
              {record.type === "modification" ? (
                <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Current booking</p>
                    <p>{formatEventDate(b.eventDate, "short")} · {b.slotLabel} · {b.guestCount.toLocaleString("en-US")} guests{b.menuPreference ? ` · ${b.menuPreference.title}` : ""}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Requested</p>
                    <ul className="list-disc pl-5">
                      {view.summary.map((s) => <li key={s} className="break-words">{s}</li>)}
                    </ul>
                    {record.requestedSlot && (
                      <p className="mt-1">
                        Requested slot now: <SlotStateText state={requestedSlotNow} />{" "}
                        <span className="text-xs text-ink-muted">(at request: {record.requestedSlot.stateAtRequest})</span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 break-words text-sm">{record.reason ? `Reason: ${record.reason}` : "No reason given."}</p>
              )}
              <div className="mt-3">
                <RequestDecision
                  requestId={record.requestId}
                  type={record.type}
                  summary={view.summary}
                  bookingUpdatedAt={updatedAt}
                  requestedSlotNow={record.requestedSlot ? requestedSlotNow : null}
                  financialAdjustment={financialAdjustment}
                  paidSoFar={b.payment.advanceReceived}
                />
              </div>
            </article>
          ))}
          {decided.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {decided.map(({ record, view }) => (
                <li key={record.requestId} className="py-2">
                  <span className="font-semibold">{record.type === "cancellation" ? "Cancellation" : "Change"}</span> ·{" "}
                  {REQUEST_STATUS_LABELS[record.status]} · submitted {formatTimestamp(view.createdAt)}
                  {record.decidedAt && ` · decided ${formatTimestamp(new Date(record.decidedAt).toISOString())}`}
                  {record.decisionReason && <span className="block text-ink-muted">Note: {record.decisionReason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Admin notes (internal)">
          <AdminNotesForm bookingId={b.bookingId} initial={b.adminNotes} updatedAt={updatedAt} />
        </Panel>
        <Panel title="Timeline">
          <ol className="space-y-1 text-sm">
            {timeline.map((t) => (
              <li key={t.label}>
                <span className="font-semibold">{t.label}</span> · {formatTimestamp(t.at)}
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel title="Admin history">
        {audit.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {audit.map((a) => (
              <li key={a.auditId} className="py-2">
                <span className="font-semibold">{a.label}</span> · {formatTimestamp(new Date(a.at).toISOString())} · {a.actor.email ?? a.actor.uid}
                {a.reason && <span className="block break-words text-ink-muted">Reason: {a.reason}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
