"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../Icon";

const ITEMS = [
  { href: "/account", label: "Overview", match: (p: string) => p === "/account" },
  { href: "/account/bookings", label: "My bookings", match: (p: string) => p.startsWith("/account/bookings") },
  { href: "/account/notifications", label: "Notifications", match: (p: string) => p.startsWith("/account/notifications") },
  { href: "/account/profile", label: "Profile", match: (p: string) => p.startsWith("/account/profile") },
];

/** Customer-area sections. Links work without JavaScript; this only marks the current one. */
export default function PortalNav({ unread = null }: { unread?: number | null }) {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Your account" className="container-px mx-auto max-w-4xl">
      <ul className="-mb-px flex gap-1 overflow-x-auto no-scrollbar">
        {ITEMS.map((item) => {
          const current = item.match(pathname);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-[48px] items-center border-b-2 px-3 text-sm font-semibold transition-colors sm:px-4 ${
                  current ? "border-gold text-ink" : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {item.href === "/account/notifications" && <Icon name="bell" className="mr-1.5 h-4 w-4" />}
                {item.label}
                {item.href === "/account/notifications" && unread !== null && unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-espresso px-1.5 py-0.5 text-xs font-semibold leading-none text-white">
                    {unread > 99 ? "99+" : unread}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
