import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // typedRoutes: intentionally DISABLED. It's an experimental feature
  // that caused more type friction (Footer/GradientButton/Logo all hit
  // RouteImpl errors) than it shipped value. We use Next.js Link with
  // string hrefs and rely on TSC + unit tests to catch broken links.
  // Revisit when typedRoutes graduates from experimental.
  experimental: {},
  // Include the knowledge base markdown files in the serverless function
  // bundle. Without this, /api/knowledge/* returns empty and /api/score
  // falls back to mock because the scoring pipeline calls loadSkills() /
  // loadPatterns() which read from `src/lib/ai/knowledge/` at runtime.
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/lib/ai/knowledge/**/*.md"],
    "/api/score/route": ["./src/lib/ai/knowledge/**/*.md"],
    "/api/talking-points/route": ["./src/lib/ai/knowledge/**/*.md"],
    "/api/progression/route": ["./src/lib/ai/knowledge/**/*.md"],
    "/api/score-internal/route": ["./src/lib/ai/knowledge/**/*.md"],
  },
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
    ];
  },
};

export default config;
