"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", match: (p: string) => p === "/admin" },
  { href: "/admin/bookings", label: "Bookings", match: (p: string) => p.startsWith("/admin/bookings") },
  { href: "/admin/calendar", label: "Calendar", match: (p: string) => p.startsWith("/admin/calendar") },
  { href: "/admin/events", label: "Events", match: (p: string) => p.startsWith("/admin/events") },
  { href: "/admin/vendors", label: "Vendors", match: (p: string) => p.startsWith("/admin/vendors") },
  { href: "/admin/communications", label: "Communications", match: (p: string) => p.startsWith("/admin/communications") },
  { href: "/admin/reviews", label: "Reviews", match: (p: string) => p.startsWith("/admin/reviews") },
  { href: "/admin/customers", label: "Customers", match: (p: string) => p.startsWith("/admin/customers") },
  { href: "/admin/settings", label: "Settings", match: (p: string) => p.startsWith("/admin/settings") },
];

export default function AdminNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Admin" className="mx-auto max-w-6xl px-4 sm:px-6">
      <ul className="-mb-px flex gap-1 overflow-x-auto no-scrollbar">
        {ITEMS.map((item) => {
          const current = item.match(pathname);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center border-b-2 px-3 text-sm font-semibold ${
                  current ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
