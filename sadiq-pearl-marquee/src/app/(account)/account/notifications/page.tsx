import type { Metadata } from "next";
import Link from "next/link";
import NotificationList from "@/components/account/NotificationList";
import { EmptyState, PortalError } from "@/components/account/PortalStates";
import { requireUser } from "@/lib/auth/server";
import { loadCustomerNotifications } from "@/lib/booking/communications-server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/account/notifications");
  const params = await searchParams;
  const before = typeof params.before === "string" ? params.before : null;
  // Always read fresh from the customer's own stored notifications (no cache).
  const result = await loadCustomerNotifications(user.uid, before);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow text-xs">Your account</p>
        <h1 className="mt-4 font-display text-[2.25rem] font-medium leading-[1.05] text-ink sm:text-5xl">Notifications</h1>
        <p className="mt-2 text-[0.9375rem] text-ink-soft">Updates about your bookings, quotations and payments.</p>
      </header>
      {!result.ok ? (
        <PortalError retryHref="/account/notifications" reason={result.reason} subject="notifications" />
      ) : result.items.length === 0 ? (
        <EmptyState icon="bell" title={before ? "No older notifications" : "You're all caught up."}>
          {before ? (
            <Link href="/account/notifications" className="font-semibold text-gold underline-offset-2 hover:underline">Back to the latest</Link>
          ) : (
            "When something changes on one of your bookings, it will appear here."
          )}
        </EmptyState>
      ) : (
        <>
          <NotificationList items={result.items} unread={result.unread} />
          <nav aria-label="Pages" className="flex flex-wrap gap-2">
            {before && <Link href="/account/notifications" className="btn btn-outline btn-sm">Latest</Link>}
            {result.nextBefore && (
              <Link href={`/account/notifications?before=${encodeURIComponent(result.nextBefore)}`} className="btn btn-outline btn-sm">
                Older notifications
              </Link>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
