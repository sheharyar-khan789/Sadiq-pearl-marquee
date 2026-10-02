import type { Metadata } from "next";
import Link from "next/link";
import { AdminError, Empty, PageHeader } from "@/components/admin/AdminUi";
import ReviewModeration from "@/components/admin/ReviewModeration";
import { Stars } from "@/components/Icon";
import { formatTimestamp } from "@/lib/booking/format";
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, type ReviewStatus } from "@/lib/booking/reviews";
import { loadAdminReviews } from "@/lib/booking/reviews-server";

export const metadata: Metadata = { title: "Reviews" };

const TAB_LABEL: Record<ReviewStatus, string> = { pending: "Waiting", approved: "Published", rejected: "Rejected" };

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const status = (REVIEW_STATUSES as readonly string[]).includes(String(params.status)) ? (params.status as ReviewStatus) : "pending";
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 80) : "";
  const result = await loadAdminReviews(status);
  const list = result.ok ? result.data.list.filter((r) => !q || r.displayName.toLowerCase().includes(q) || r.text.toLowerCase().includes(q) || r.bookingId.includes(q)) : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Reviews" subtitle="Guest reviews of completed events. Only approved reviews appear on the public Reviews page." />
      <nav aria-label="Review status" className="flex flex-wrap gap-2">
        {REVIEW_STATUSES.map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} aria-current={status === s ? "page" : undefined} className={`btn btn-sm ${status === s ? "btn-primary" : "btn-outline"}`}>
            {TAB_LABEL[s]}
            {s === "pending" && result.ok && result.data.pendingCount > 0 ? ` (${result.data.pendingCount})` : ""}
          </Link>
        ))}
      </nav>
      <form method="get" action="/admin/reviews" className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="status" value={status} />
        <div className="min-w-0 flex-1">
          <label htmlFor="r-q" className="mb-1 block text-xs font-semibold text-ink">Search (name, text, booking)</label>
          <input id="r-q" name="q" defaultValue={q} className="block h-11 w-full rounded-xl border border-line-strong/50 bg-surface px-3 text-sm text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-gold-container/40" />
        </div>
        <button type="submit" className="btn btn-outline btn-sm">Search</button>
      </form>
      {!result.ok ? (
        <AdminError reason={result.reason} retryHref="/admin/reviews" />
      ) : list.length === 0 ? (
        <Empty>No {TAB_LABEL[status].toLowerCase()} reviews.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.reviewId} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Stars value={r.rating} className="h-3.5 w-3.5" />
                    <span className="text-sm font-semibold text-ink">{r.rating}/5 · {r.displayName}</span>
                    <span className="text-xs text-ink-muted">{REVIEW_STATUS_LABELS[r.status]}</span>
                  </p>
                  <p className="mt-2 whitespace-pre-line break-words text-[0.9375rem] text-ink">{r.text}</p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {r.eventTypeLabel} ·{" "}
                    <Link href={`/admin/bookings/${r.bookingId}`} className="inline-flex min-h-[44px] items-center font-mono underline-offset-2 hover:underline">
                      SP-{r.bookingId.slice(-8).toUpperCase()}
                    </Link>{" "}
                    · submitted {formatTimestamp(new Date(r.createdAt).toISOString())}
                    {r.revision > 0 && ` · edited ${r.revision}×, last ${formatTimestamp(new Date(r.updatedAt).toISOString())}`}
                    {r.moderation && ` · ${r.status === "approved" ? "approved" : "decided"} by ${r.moderation.by}`}
                    {r.moderation?.note && ` · note: ${r.moderation.note}`}
                  </p>
                </div>
                <div className="shrink-0">
                  <ReviewModeration reviewId={r.reviewId} status={r.status} updatedAt={new Date(r.updatedAt).toISOString()} name={r.displayName} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
