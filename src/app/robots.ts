import type { MetadataRoute } from "next";

// Phase 16 pre-prod — public launch chrome. App surfaces are auth-gated
// and noise for crawlers; marketing pages are the index surface.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard",
          "/workout",
          "/skill-lab",
          "/build-a-rep",
          "/progress",
          "/achievements",
          "/leaderboard",
          "/library",
          "/friends",
          "/compare",
          "/report",
          "/settings",
          "/drills",
          "/validate",
          "/tutorial",
          "/onboarding/",
          "/ops",
          "/admin",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
