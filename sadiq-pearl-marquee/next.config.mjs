import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

// Phase 11: canonical URLs, sitemap, robots, Open Graph and structured data all
// use NEXT_PUBLIC_SITE_URL (src/lib/config.ts). Without it they fall back to an
// unconfirmed placeholder host, so say so loudly on every production build
// (same validation as config.ts; no domain is guessed here).
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '');
if (isProduction && !(siteUrl && /^https:\/\/[a-z0-9.-]+$/i.test(siteUrl))) {
  console.warn(
    '\n[config] WARNING: NEXT_PUBLIC_SITE_URL is not set to a valid https:// address. ' +
      'Canonical URLs, sitemap, robots.txt, Open Graph and structured data will use the PLACEHOLDER domain. ' +
      'Set the confirmed production domain before launch.\n'
  );
}

// Phase 11: a deliberately narrow Content-Security-Policy. It only blocks
// framing by other sites, plugins (<object>/<embed>), <base> hijacking and
// form posts to other origins. Script / style / media / connect sources are
// NOT restricted, so Firebase Auth (popup + iframe), the emulator in tests,
// the hero videos and inline JSON-LD keep working unchanged. A full script
// allow-list (nonces) is a separate, tested change.
const contentSecurityPolicy = [
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  // Pin the project root (a stray lockfile in the user's home folder otherwise
  // makes Turbopack guess the workspace root).
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
  images: {
    // WebP only. AVIF was originally disabled to avoid GHSA-2xp9-vwfh-vxw4
    // on Next 14.2.x; that advisory is fixed in Next 16. AVIF stays off for
    // now so image output is unchanged; re-enabling it is a separate decision.
    formats: ['image/webp'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          // Production builds only. Browsers honour HSTS only on HTTPS
          // responses, so it has no effect on local http:// testing. No
          // includeSubDomains / preload: the final domain is not confirmed yet.
          ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
