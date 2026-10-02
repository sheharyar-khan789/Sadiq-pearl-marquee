import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AccountPanel from "@/components/auth/AccountPanel";
import BookingCard from "@/components/account/BookingCard";
import { EmptyState, PortalError, Skeleton, WhatsAppLink } from "@/components/account/PortalStates";
import Icon from "@/components/Icon";
import { requireUser } from "@/lib/auth/server";
import { nextUpcoming, summaryCounts } from "@/lib/booking/portal";
import { loadCustomerOverview } from "@/lib/booking/portal-server";

export const metadata: Metadata = { title: "Your account" };

export default async function AccountPage() {
  // Server-side check: verifies the httpOnly session cookie with the Admin SDK.
  const user = await requireUser("/account");
  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow text-xs">Your account</p>
        <h1 className="mt-4 font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-5xl">
          Welcome{firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      <Suspense fallback={<DashboardBookingsLoading />}>
        <DashboardBookings uid={user.uid} />
      </Suspense>

      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="mb-4 font-display text-[1.75rem] text-ink">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/book" className="btn btn-primary justify-start">
            <Icon name="calendar" className="h-4 w-4" />
            Book your event
          </Link>
          <Link href="/account/bookings" className="btn btn-outline justify-start">
            <Icon name="doc" className="h-4 w-4" />
            View my bookings
          </Link>
          <Link href="/account/profile" className="btn btn-outline justify-start">
            <Icon name="user" className="h-4 w-4" />
            Edit profile
          </Link>
          <WhatsAppLink label="WhatsApp support" className="btn btn-outline justify-start" />
        </div>
      </section>

      <section aria-labelledby="account-title">
        <h2 id="account-title" className="sr-only">
          Account status
        </h2>
        <AccountPanel
          initial={{
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            signInProvider: user.signInProvider,
          }}
        />
      </section>
    </div>
  );
}

/** Bookings part of the dashboard. Streams in separately, so account status and
 *  sign-out are usable at once even if the database is slow. */
async function DashboardBookings({ uid }: { uid: string }) {
  const overview = await loadCustomerOverview(uid);
  return (
    <>
      <section aria-labelledby="upcoming-title">
        <h2 id="upcoming-title" className="mb-4 font-display text-[1.75rem] text-ink">
          Your next event
        </h2>
        {!overview.ok ? (
          <PortalError retryHref="/account" reason={overview.reason} />
        ) : (
          (() => {
            const next = nextUpcoming(overview.data.bookings, overview.data.today);
            if (next) {
              return (
                <BookingCard booking={next} openRequestTypes={overview.data.openRequests[next.bookingId]} headingLevel="h3" />
              );
            }
            return (
              <EmptyState
                title={overview.data.bookings.length ? "No upcoming event" : "No bookings yet"}
                action={
                  <Link href="/book" className="btn btn-primary">
                    Plan your event
                    <Icon name="arrow" className="h-4 w-4" />
                  </Link>
                }
              >
                {overview.data.bookings.length
                  ? "You have no upcoming bookings. Your earlier bookings are under My bookings."
                  : "When you send a booking request, it will appear here."}
              </EmptyState>
            );
          })()
        )}
      </section>

      {overview.ok && overview.data.bookings.length > 0 && (
        <section aria-labelledby="summary-title">
          <h2 id="summary-title" className="mb-4 font-display text-[1.75rem] text-ink">
            Booking summary
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(
              [
                ["Upcoming", "upcoming"],
                ["Pending", "pending"],
                ["Confirmed", "confirmed"],
                ["Completed", "completed"],
                ["Cancelled", "cancelled"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="rounded-2xl border border-line bg-surface px-4 py-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{label}</dt>
                <dd className="mt-1 font-display text-3xl text-ink">
                  {summaryCounts(overview.data.bookings, overview.data.today)[key]}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function DashboardBookingsLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading your bookings…</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44 w-full rounded-3xl" />
    </div>
  );
}
