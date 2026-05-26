import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// CSP — shipping in Report-Only mode first so we get violation telemetry
// from a preview deploy before flipping to enforcement. If a needed origin
// is missing here, Report-Only just logs to the browser console; nothing
// breaks. Once 24h of preview shows no missing origins, swap the header
// key from Content-Security-Policy-Report-Only → Content-Security-Policy.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' + 'unsafe-eval' on script-src are required for Next's
  // inline boot script + dev HMR. A nonce-based replacement is the long-term
  // tightening, but it requires App Router upgrades coordinated separately.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' blob: data: *.supabase.co *.public.blob.vercel-storage.com",
  "media-src 'self' blob: *.supabase.co *.public.blob.vercel-storage.com",
  "connect-src 'self' *.supabase.co *.upstash.io api.anthropic.com api.deepgram.com api.hume.ai",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes: intentionally DISABLED. It's an experimental feature
  // that caused more type friction (Footer/GradientButton/Logo all hit
  // RouteImpl errors) than it shipped value. We use Next.js Link with
  // string hrefs and rely on TSC + unit tests to catch broken links.
  // Revisit when typedRoutes graduates from experimental.
  experimental: {},
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // microphone allow-list. camera/geolocation/payment explicitly
          // denied so a future XSS can't trigger user prompts.
          {
            key: "Permissions-Policy",
            value:
              "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
          // HSTS — 2 years, includeSubDomains, preload. Safe on Vercel
          // since the platform is HTTPS-only. The preload directive
          // requires manual submission to hstspreload.org once we're
          // confident; the header itself is no-op until then.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Report-Only first. Flip the header key to drop the suffix
          // once a preview deploy shows no violations.
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_DIRECTIVES,
          },
        ],
      },
      // Service-worker file must serve with no-cache so updates roll
      // out on the next page load instead of waiting out a CDN TTL.
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
      },
    ];
  },
};

// Phase D — Serwist PWA service worker. Disabled in dev so HMR isn't
// fighting a cached bundle. Builds emit public/sw.js on production
// builds; ServiceWorkerRegister.tsx registers it client-side.
//
// cacheOnNavigation: turned OFF (audit PR-23). When true, the SW
// caches HTML navigations and could serve a signed-in shell to a
// just-signed-out user for one nav cycle. The PWA still works
// offline for static assets + already-loaded routes via the
// runtime cache; only the HTML shell now always re-fetches.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(config);
