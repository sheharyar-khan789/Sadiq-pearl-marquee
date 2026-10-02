import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader, Panel } from "@/components/admin/AdminUi";
import VendorForm from "@/components/admin/VendorForm";
import { VENDOR_CATEGORY_LABELS } from "@/lib/booking/operations-model";
import { loadVendors } from "@/lib/booking/operations-server";

export const metadata: Metadata = { title: "Vendors" };

export default async function AdminVendorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const show = params.show === "all" ? "all" : "active";
  const result = await loadVendors(show);
  return (
    <div className="space-y-5">
      <PageHeader title="Vendors" subtitle="Decorators, photographers, sound, lighting and other vendors you work with. Only vendors you add appear here." />
      <nav aria-label="Vendor filter" className="flex gap-2">
        <Link href="/admin/vendors" aria-current={show === "active" ? "page" : undefined} className={`btn btn-sm ${show === "active" ? "btn-primary" : "btn-outline"}`}>Active</Link>
        <Link href="/admin/vendors?show=all" aria-current={show === "all" ? "page" : undefined} className={`btn btn-sm ${show === "all" ? "btn-primary" : "btn-outline"}`}>All (incl. inactive)</Link>
      </nav>
      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/vendors" />
      ) : result.data.length === 0 ? (
        <Empty>{show === "active" ? "No vendors yet. Add the vendors you work with below." : "No vendors yet."}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {result.data.map((v) => (
            <li key={v.vendorId}>
              <Link href={`/admin/vendors/${v.vendorId}`} className="block rounded-2xl border border-line bg-surface p-4 hover:border-ink/40">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-ink">{v.name}</span>
                  <span className="text-xs font-semibold text-ink-soft">{VENDOR_CATEGORY_LABELS[v.category]}{v.active ? "" : " · Inactive"}</span>
                </span>
                <span className="block text-sm text-ink-soft">{v.phone}{v.whatsapp ? ` · WhatsApp ${v.whatsapp}` : ""}{v.email ? ` · ${v.email}` : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Panel title="Add a vendor">
        <VendorForm />
      </Panel>
    </div>
  );
}
