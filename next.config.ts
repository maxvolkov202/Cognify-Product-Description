import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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
          { key: "Permissions-Policy", value: "microphone=(self)" },
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
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(config);
