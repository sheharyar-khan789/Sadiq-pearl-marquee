import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminError, BookingRows, PageHeader, Panel } from "@/components/admin/AdminUi";
import { loadCustomer } from "@/lib/booking/admin-server";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage({ params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const result = await loadCustomer(uid);
  if (!result.ok) {
    return (
      <>
        <PageHeader title="Customer" />
        <AdminError reason={result.reason} retryHref={`/admin/customers/${encodeURIComponent(uid)}`} />
      </>
    );
  }
  if (!result.data) notFound();
  const { profile, bookings, today } = result.data;
  const active = ["pending", "under_review", "confirmed"];
  const upcoming = bookings.filter((b) => b.eventDate >= today && active.includes(b.status)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const past = bookings.filter((b) => !upcoming.includes(b)).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const name = profile?.name ?? bookings[0]?.customerName ?? "Customer";

  return (
    <div className="space-y-5">
      <p>
        <Link href="/admin/customers" className="inline-flex min-h-[44px] items-center text-sm font-semibold text-ink-soft hover:text-ink">
          ← Customers
        </Link>
      </p>
      <PageHeader title={name} subtitle="Online account" />
      <Panel title="Profile">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-muted">Email</dt><dd className="break-all font-semibold">{profile?.email ?? bookings[0]?.customerEmail ?? "—"}</dd></div>
          <div><dt className="text-ink-muted">Phone</dt><dd className="font-semibold">{profile?.phone ?? bookings[0]?.customerPhone ?? "—"}</dd></div>
          <div><dt className="text-ink-muted">Email verified</dt><dd className="font-semibold">{profile ? (profile.emailVerified ? "Yes" : "No") : "—"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink-muted">Passwords and sign-in details are managed by Firebase Authentication and can&rsquo;t be viewed or changed here.</p>
      </Panel>
      <Panel title={`Upcoming bookings (${upcoming.length})`}>
        <BookingRows rows={upcoming} />
      </Panel>
      <Panel title={`Past & closed bookings (${past.length})`}>
        <BookingRows rows={past} />
      </Panel>
    </div>
  );
}
