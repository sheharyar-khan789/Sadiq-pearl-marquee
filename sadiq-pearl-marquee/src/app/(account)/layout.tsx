import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AuthTopBar } from "@/components/auth/AuthFrame";
import PortalNav from "@/components/account/PortalNav";
import { safeNextPath } from "@/lib/auth/constants";
import { requireUser } from "@/lib/auth/server";
import { loadUnreadCount } from "@/lib/booking/communications-server";

// Customer area (/account/*). Private: never indexed.
// Every page and data access under here must call requireUser() server-side;
// the proxy's cookie-presence check is only an optimistic first filter.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  // Verify the session BEFORE anything streams, so an expired or forged cookie
  // gets a real redirect (the pages below verify again for their own data).
  const user = await requireUser(safeNextPath((await headers()).get("x-sp-return-to")));
  // Phase 9: unread count from the customer's stored notifications (fresh on every render; null if unreadable).
  const unread = await loadUnreadCount(user.uid);
  return (
    <AuthProvider>
      <div className="min-h-svh bg-surface-low">
        <div className="border-b border-line bg-surface">
          <AuthTopBar />
          <PortalNav unread={unread} />
        </div>
        <main id="main" className="container-px mx-auto max-w-4xl py-10 sm:py-14">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
