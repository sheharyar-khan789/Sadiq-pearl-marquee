import type { Metadata } from "next";
import Link from "next/link";
import BookingCard from "@/components/account/BookingCard";
import { EmptyState, PortalError, WhatsAppLink } from "@/components/account/PortalStates";
import Icon from "@/components/Icon";
import { requireUser } from "@/lib/auth/server";
import { BOOKING_FILTERS, FILTER_LABELS, matchesFilter, parseFilter, sortForCustomer } from "@/lib/booking/portal";
import { loadCustomerOverview } from "@/lib/booking/portal-server";

export const metadata: Metadata = { title: "My bookings" };

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/bookings");
  const filter = parseFilter((await searchParams).filter);
  // One query scoped to this customer's uid; filtering happens on the server.
  const overview = await loadCustomerOverview(user.uid);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-xs">Your account</p>
          <h1 className="mt-4 font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-5xl">My bookings</h1>
        </div>
        <Link href="/book" className="btn btn-primary self-start sm:self-auto">
          <Icon name="calendar" className="h-4 w-4" />
          Book another event
        </Link>
      </header>

      {!overview.ok ? (
        <PortalError retryHref={`/account/bookings${filter === "all" ? "" : `?filter=${filter}`}`} reason={overview.reason} />
      ) : overview.data.bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          action={
            <>
              <Link href="/book" className="btn btn-primary">
                Plan your event
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <WhatsAppLink label="Ask us on WhatsApp" />
            </>
          }
        >
          Check free dates and send us a booking request. It will appear here with its status.
        </EmptyState>
      ) : (
        (() => {
          const { bookings, today, openRequests } = overview.data;
          const shown = sortForCustomer(bookings, today).filter((b) => matchesFilter(b, filter, today));
          return (
            <>
              <nav aria-label="Filter bookings">
                <ul className="flex flex-wrap gap-2">
                  {BOOKING_FILTERS.map((f) => {
                    const count = bookings.filter((b) => matchesFilter(b, f, today)).length;
                    const current = f === filter;
                    return (
                      <li key={f}>
                        <Link
                          href={f === "all" ? "/account/bookings" : `/account/bookings?filter=${f}`}
                          aria-current={current ? "page" : undefined}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
                            current
                              ? "border-espresso bg-espresso text-surface"
                              : "border-line-strong/50 bg-surface text-ink-soft hover:border-ink/50 hover:text-ink"
                          }`}
                        >
                          {FILTER_LABELS[f]}
                          <span className={current ? "text-surface/70" : "text-ink-muted"}>{count}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {shown.length === 0 ? (
                <EmptyState
                  title={`No ${FILTER_LABELS[filter].toLowerCase()} bookings`}
                  action={
                    <Link href="/account/bookings" className="btn btn-outline">
                      Show all bookings
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-4" aria-label={`${FILTER_LABELS[filter]} bookings`}>
                  {shown.map((b) => (
                    <li key={b.bookingId}>
                      <BookingCard booking={b} openRequestTypes={openRequests[b.bookingId]} headingLevel="h2" />
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}
