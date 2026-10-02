import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/config";
import { PRIVATE_PATHS } from "@/lib/seo";

// Public pages are crawlable; account, admin, sign-in flows and APIs are not.
// (Those pages also send `noindex` themselves.)
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
