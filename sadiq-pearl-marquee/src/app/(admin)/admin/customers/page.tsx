import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader, StatusPill } from "@/components/admin/AdminUi";
import { searchCustomers } from "@/lib/booking/admin-view";
import { loadCustomers } from "@/lib/booking/admin-server";
import { formatEventDate } from "@/lib/booking/format";

export const metadata: Metadata = { title: "Customers" };
const PAGE = 50;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const result = await loadCustomers();

  return (
    <div className="space-y-5">
      <PageHeader title="Customers" subtitle="Online accounts and offline contacts from staff-entered bookings." />
      <form method="get" action="/admin/customers" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="c-q" className="mb-1 block text-xs font-semibold text-ink">Search name, email or phone</label>
          <input id="c-q" name="q" defaultValue={q} className="block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40" />
        </div>
        <button type="submit" className="btn btn-primary btn-sm">Search</button>
      </form>

      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/customers" />
      ) : (
        (() => {
          const all = searchCustomers(result.data, q);
          const pages = Math.max(1, Math.ceil(all.length / PAGE));
          const rows = all.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
          if (!rows.length) return <Empty>No customers found.</Empty>;
          return (
            <>
              <p className="text-sm text-ink-soft">{all.length} customer{all.length === 1 ? "" : "s"}</p>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {rows.map((c) => {
                  const href = c.uid
                    ? `/admin/customers/${c.uid}`
                    : `/admin/bookings?q=${encodeURIComponent((c.phone ?? "").replace(/\D/g, ""))}&from=2000-01-01&to=2999-12-31`;
                  return (
                    <li key={c.key}>
                      <Link href={href} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-low sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink">{c.name || "(no name)"} {!c.uid && <span className="text-xs font-normal text-ink-muted">· offline</span>}</span>
                          <span className="block break-all text-sm text-ink-soft">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span>
                        </span>
                        <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-ink-soft">
                          {c.bookingCount} booking{c.bookingCount === 1 ? "" : "s"}
                          {c.latest && (
                            <>
                              <span>· latest {formatEventDate(c.latest.eventDate, "short")}</span>
                              <StatusPill status={c.latest.status} />
                            </>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {pages > 1 && (
                <nav aria-label="Pages" className="flex justify-between text-sm">
                  {page > 1 ? <Link className="btn btn-outline btn-sm" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</Link> : <span />}
                  <span className="text-ink-muted">Page {Math.min(page, pages)} of {pages}</span>
                  {page < pages ? <Link className="btn btn-outline btn-sm" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</Link> : <span />}
                </nav>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
