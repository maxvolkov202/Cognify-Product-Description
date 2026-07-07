import type { MetadataRoute } from "next";

// Phase 16 pre-prod — marketing surface only (app routes are auth-gated
// and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://cognifygym.com";
  const routes = [
    "",
    "/product",
    "/how-it-works",
    "/use-cases",
    "/for-individuals",
    "/for-teams",
    "/pricing",
    "/about",
    "/help",
    "/privacy",
    "/terms",
    "/signin",
  ];
  const now = new Date();
  return routes.map((r) => ({
    url: `${base}${r}`,
    lastModified: now,
    changeFrequency: r === "" ? "weekly" : "monthly",
    priority: r === "" ? 1 : 0.6,
  }));
}
