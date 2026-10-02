import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminError, Empty, PageHeader, Panel, StatusPill } from "@/components/admin/AdminUi";
import { ChecklistPanel, NotesPanel, OpsStatusControl, VendorPanel } from "@/components/admin/EventOps";
import { FinancialStatusPill } from "@/components/admin/FinancePanel";
import { OpsStatusPill } from "@/components/admin/OpsUi";
import { formatEventDate, formatPKR, formatTimestamp } from "@/lib/booking/format";
import { loadEventSheet } from "@/lib/booking/operations-server";
import { normalizeWhatsAppNumber } from "@/lib/booking/whatsapp-messages";

export const metadata: Metadata = { title: "Event sheet" };

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

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

export default async function EventSheetPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const result = await loadEventSheet(bookingId);
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Event sheet" />
        <AdminError reason={result.reason} retryHref={`/admin/events/${encodeURIComponent(bookingId)}`} />
      </>
    );
  }
  if (!result.data) notFound();
  const d = result.data;
  const b = d.booking;
  const ops = d.operations;
  const canAssign = b.status === "confirmed";

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap gap-x-4">
        <Link href="/admin/events" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">← Events</Link>
        <Link href={`/admin/bookings/${b.bookingId}`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">Booking &amp; payments →</Link>
      </p>
      <PageHeader
        title={`${formatEventDate(b.eventDate)} · ${b.slotLabel}`}
        subtitle={`${d.reference} · ${b.eventTypeLabel} · ${b.hallName}`}
        action={
          <span className="flex flex-wrap gap-2">
            <StatusPill status={b.status} />
            <OpsStatusPill status={ops.status} />
          </span>
        }
      />

      {!d.operational && (
        <p role="note" className="rounded-xl border border-line-strong bg-surface-mid px-3 py-2 text-sm text-ink">
          This booking is {b.status.replace("_", " ")}, so it is not an active event. Its operational history is shown read-only.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Event">
          <Facts
            items={[
              ["Reference", <span key="r" className="font-mono">{d.reference}</span>],
              ["Date", formatEventDate(b.eventDate)],
              ["Slot", b.slotLabel],
              ["Hall", b.hallName],
              ["Event type", b.eventTypeLabel],
              ["Guests", b.guestCount.toLocaleString("en-US")],
            ]}
          />
        </Panel>
        <Panel title="Customer">
          <Facts
            items={[
              ["Name", b.customer.name || "—"],
              ["Phone", b.customer.phone ? <a key="p" href={`tel:${b.customer.phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[44px] items-center text-gold underline-offset-2 hover:underline">{b.customer.phone}</a> : "—"],
              ["Email", b.customer.email ?? "—"],
            ]}
          />
        </Panel>
        <Panel title="Payment summary">
          {/* Read-only: from the booking's stored price and recorded payments (Phase 7). */}
          <div className="mb-2"><FinancialStatusPill status={d.finance.status} /></div>
          {d.finance.total === null ? (
            <p className="text-sm text-ink-soft">No price stored yet.</p>
          ) : (
            <dl className="divide-y divide-line text-sm">
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">Total</dt><dd className="tabular-nums font-semibold">{formatPKR(d.finance.total)}</dd></div>
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">Paid</dt><dd className="tabular-nums">{formatPKR(d.finance.paid)}</dd></div>
              <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-soft">Remaining</dt><dd className="tabular-nums font-semibold">{formatPKR(d.finance.remaining ?? 0)}</dd></div>
            </dl>
          )}
          <p className="mt-2 text-xs text-ink-muted">Payments are recorded on the <Link href={`/admin/bookings/${b.bookingId}#finance`} className="underline">booking page</Link>.</p>
        </Panel>
      </div>

      <Panel title="Selections">
        <Facts
          items={[
            ["Package", b.package?.name ?? "None"],
            ["Menu", b.menuPreference?.title ?? "None"],
            ["Services", b.services.length ? b.services.map((s) => s.label).join(", ") : "None"],
            ["Customer notes", b.customerNotes || "None"],
          ]}
        />
      </Panel>

      <Panel title="Operational status" id="status">
        <OpsStatusControl bookingId={b.bookingId} status={ops.status} eventDate={b.eventDate} today={d.today} editable={d.operational} />
        {!d.stored && d.operational && <p className="mt-2 text-xs text-ink-muted">The operational record is created with the first change.</p>}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Preparation checklist" id="checklist">
          <ChecklistPanel
            bookingId={b.bookingId}
            editable={d.operational}
            outOfDate={d.checklistOutOfDate}
            items={ops.checklist.map((i) => ({
              id: i.id,
              label: i.label,
              source: i.source,
              status: i.status,
              note: i.note,
              removed: i.removed,
              completedAt: iso(i.completedAt),
              completedBy: i.completedBy,
              updatedBy: i.updatedBy,
            }))}
          />
        </Panel>
        <div className="space-y-5">
          <Panel title="Vendors" id="vendors">
            <VendorPanel
              bookingId={b.bookingId}
              canAssign={canAssign}
              vendors={d.vendors}
              assignments={d.assignments.map((a) => ({
                assignmentId: a.assignmentId,
                vendorId: a.vendorId,
                vendorName: a.vendorName,
                category: a.category,
                status: a.status,
                notes: a.notes,
                assignedBy: a.assignedBy,
                assignedAt: iso(a.assignedAt)!,
                phone: a.vendor?.phone ?? null,
                whatsapp: a.vendor?.whatsapp ?? null,
                vendorActive: a.vendor?.active ?? false,
                conflicts: d.conflicts[a.assignmentId] ?? [],
                whatsappUsable: normalizeWhatsAppNumber(a.vendor?.whatsapp ?? a.vendor?.phone) !== null,
              }))}
            />
          </Panel>
          <Panel title="Internal notes" id="notes">
            <NotesPanel
              bookingId={b.bookingId}
              editable={d.operational}
              notes={ops.notes.map((n) => ({ id: n.id, text: n.text, createdAt: iso(n.createdAt)!, createdBy: n.createdBy, updatedAt: iso(n.updatedAt)!, updatedBy: n.updatedBy }))}
            />
          </Panel>
        </div>
      </div>

      {ops.completedSnapshot && (
        <Panel title="Completed event record">
          <p className="text-sm text-ink-soft">
            {formatEventDate(ops.completedSnapshot.eventDate)} · {ops.completedSnapshot.slotLabel} · {ops.completedSnapshot.hallName} ·{" "}
            {ops.completedSnapshot.guestCount.toLocaleString("en-US")} guests · {ops.completedSnapshot.customerName}
            {ops.completedSnapshot.total !== null &&
              ` · total ${formatPKR(ops.completedSnapshot.total)}, paid ${formatPKR(ops.completedSnapshot.paid)}, remaining ${formatPKR(ops.completedSnapshot.remaining ?? 0)}`}
          </p>
        </Panel>
      )}

      <Panel title="Operations history">
        {d.history.length === 0 ? (
          <Empty>No operational changes yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {d.history.map((a) => (
              <li key={a.auditId} className="py-2">
                <span className="font-semibold">{a.label}</span> · {formatTimestamp(new Date(a.at).toISOString())} · {a.actor.email ?? a.actor.uid}
                {a.after && typeof a.after.status === "string" && <span className="text-ink-muted"> · {String(a.before?.status ?? "")} → {a.after.status}</span>}
                {a.after && typeof a.after.item === "string" && <span className="text-ink-muted"> · {a.after.item}</span>}
                {a.after && typeof a.after.vendor === "string" && <span className="text-ink-muted"> · {a.after.vendor}</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
