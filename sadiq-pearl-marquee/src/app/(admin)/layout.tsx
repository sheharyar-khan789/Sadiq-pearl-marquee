import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import { safeNextPath } from "@/lib/auth/constants";
import { requireSuperAdmin } from "@/lib/auth/server";

// Super Admin area (/admin/*). Private: never indexed.
// The Super Admin is verified here, on the server, BEFORE anything renders or
// streams: a valid session cookie + the server-set custom claim
// role=super_admin + a verified email (src/lib/auth/server.ts). Anyone else
// gets a 404 so the admin area isn't revealed. Every admin API route checks
// again (requireSuperAdminApi); hiding links in the UI is not the security.
export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireSuperAdmin(safeNextPath((await headers()).get("x-sp-return-to"), "/admin"));
  return (
    <div className="min-h-svh bg-surface-low">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-6">
          <Link href="/admin" className="leading-none">
            <span className="font-display text-xl font-semibold text-ink">Sadiq Pearl</span>
            <span className="ml-2 rounded bg-espresso px-1.5 py-0.5 align-middle text-[0.75rem] font-semibold uppercase tracking-wider text-surface">
              Admin
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-sm text-ink-soft">
            <span className="hidden truncate sm:inline">{admin.email}</span>
            <Link href="/" className="inline-flex min-h-[44px] items-center font-semibold hover:text-ink">
              View site
            </Link>
            <Link href="/account" className="inline-flex min-h-[44px] items-center font-semibold hover:text-ink">
              Account
            </Link>
          </div>
        </div>
        <AdminNav />
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
