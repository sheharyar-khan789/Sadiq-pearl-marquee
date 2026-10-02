import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";

// Only public, indexable pages with a stable URL. No account, admin, auth,
// API, booking-record or query-string URLs.
export const PUBLIC_PAGES: { path: string; changeFrequency: "weekly" | "monthly"; priority: number }[] = [
  { path: "/", changeFrequency: "monthly", priority: 1.0 },
  { path: "/gallery", changeFrequency: "monthly", priority: 0.8 },
  { path: "/reviews", changeFrequency: "weekly", priority: 0.6 },
  { path: "/book", changeFrequency: "weekly", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((p) => ({
    url: p.path === "/" ? siteUrl : `${siteUrl}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
