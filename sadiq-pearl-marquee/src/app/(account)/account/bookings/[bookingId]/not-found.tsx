import Link from "next/link";
import { EmptyState, WhatsAppLink } from "@/components/account/PortalStates";

// Same answer whether the booking doesn't exist or belongs to someone else,
// so other customers' booking IDs can't be discovered.
export default function BookingNotFound() {
  return (
    <EmptyState
      icon="doc"
      title="Booking not found"
      action={
        <>
          <Link href="/account/bookings" className="btn btn-primary">
            Go to my bookings
          </Link>
          <WhatsAppLink />
        </>
      }
    >
      We couldn&rsquo;t find this booking in your account. Please check the link, or contact us if you think this is a
      mistake.
    </EmptyState>
  );
}
