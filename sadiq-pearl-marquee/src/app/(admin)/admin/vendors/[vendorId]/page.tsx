import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminError, Empty, PageHeader, Panel, StatusPill } from "@/components/admin/AdminUi";
import VendorForm, { VendorActiveToggle } from "@/components/admin/VendorForm";
import { formatEventDate, formatTimestamp } from "@/lib/booking/format";
import { ASSIGNMENT_STATUS_LABELS, VENDOR_CATEGORY_LABELS } from "@/lib/booking/operations-model";
import { loadVendor } from "@/lib/booking/operations-server";

export const metadata: Metadata = { title: "Vendor" };

export default async function AdminVendorPage({ params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = await params;
  const result = await loadVendor(vendorId);
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Vendor" />
        <AdminError reason={result.reason} retryHref={`/admin/vendors/${encodeURIComponent(vendorId)}`} />
      </>
    );
  }
  if (!result.data) notFound();
  const { vendor: v, assignments, history } = result.data;
  const updatedAt = new Date(v.updatedAt).toISOString();
  return (
    <div className="space-y-5">
      <p><Link href="/admin/vendors" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">← Vendors</Link></p>
      <PageHeader title={v.name} subtitle={`${VENDOR_CATEGORY_LABELS[v.category]}${v.active ? "" : " · Inactive"}`} action={<VendorActiveToggle vendorId={v.vendorId} active={v.active} updatedAt={updatedAt} name={v.name} />} />
      <Panel title="Details">
        <VendorForm
          vendorId={v.vendorId}
          updatedAt={updatedAt}
          initial={{ name: v.name, category: v.category, phone: v.phone, whatsapp: v.whatsapp ?? "", email: v.email ?? "", notes: v.notes }}
        />
      </Panel>
      <Panel title="Assignments">
        {assignments.length === 0 ? (
          <Empty>Not assigned to any event yet.</Empty>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {assignments.map((a) => (
              <li key={a.assignmentId} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  {a.event ? (
                    <Link href={`/admin/events/${a.bookingId}`} className="inline-flex min-h-[44px] items-center font-semibold text-ink underline-offset-2 hover:underline">
                      {formatEventDate(a.event.eventDate, "short")} · {a.event.slotLabel} · <span className="font-mono">{a.event.reference}</span>
                    </Link>
                  ) : (
                    <span className="text-ink-muted">Booking not found</span>
                  )}
                  <span className="block text-xs text-ink-muted">{VENDOR_CATEGORY_LABELS[a.category]} · {ASSIGNMENT_STATUS_LABELS[a.status]} · {formatTimestamp(new Date(a.assignedAt).toISOString())}</span>
                </span>
                {a.event && <StatusPill status={a.event.bookingStatus} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="History">
        {history.length === 0 ? <Empty>No changes recorded.</Empty> : (
          <ul className="divide-y divide-line text-sm">
            {history.map((h) => (
              <li key={h.auditId} className="py-2"><span className="font-semibold">{h.label}</span> · {formatTimestamp(new Date(h.at).toISOString())} · {h.actor.email ?? h.actor.uid}</li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
