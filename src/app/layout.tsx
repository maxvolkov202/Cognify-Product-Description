import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.NODE_ENV === "production"
        ? "https://cognify-v2-neon.vercel.app"
        : "http://localhost:3333"),
  ),
  // Always show just "Cognify" in the tab. template with a literal (no %s)
  // causes Next.js to ignore any page-level title field and render this value.
  title: {
    template: "Cognify",
    default: "Cognify",
  },
  description:
    "Cognify is a communication training gym. Short, structured reps with instant feedback build the ability to think clearly and speak under pressure.",
  applicationName: "Cognify",
  keywords: [
    "communication training",
    "public speaking",
    "interview prep",
    "pitch training",
    "meeting presence",
    "speaking reps",
    "brain productivity",
    "corporate health",
  ],
  openGraph: {
    // Image is auto-generated at /opengraph-image (src/app/opengraph-image.tsx)
    // as a 1200x630 PNG so Slack, Twitter, and LinkedIn render the card.
    title: "Cognify, the Duolingo for communication",
    description:
      "Short, structured reps. Instant feedback. Measurable growth. Train clear thinking into clear speech.",
    siteName: "Cognify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cognify",
    description: "The Duolingo for communication.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo/mark.png", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  // Phase 12 — the muscle-group pivot ships /manifest.webmanifest with
  // the brain-gym framing + standalone display + idle-mascot splash
  // colors. Legacy /manifest.json was pre-pivot; keep redirecting via
  // public/ for backwards compat with browsers that cached it.
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#9788ff",
  width: "device-width",
  initialScale: 1,
};

// iOS standalone-mode splash images. Targeting the modern iPhone +
// iPad-mini sizes; older devices fall back to the default white splash.
// Phase D — list comes from scripts/generate-app-icons.mjs.
const APPLE_SPLASH = [
  {
    href: "/icons/apple-splash-iphone-15-pro-max.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/icons/apple-splash-iphone-15-pro.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/icons/apple-splash-iphone-14-13.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  },
  {
    href: "/icons/apple-splash-ipad-mini.png",
    media:
      "(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2)",
  },
];

// Pre-hydration theme script. Reads cognify:theme from localStorage and
// toggles the `dark` class on <html> before React paints, so app routes
// don't flash light-then-dark. Marketing + public routes are excluded —
// the prefix list mirrors src/app/(app)/* + onboarding.
const THEME_SCRIPT = `(function(){try{
  var path = window.location.pathname;
  var appPrefixes = ['/dashboard','/workout','/application-lab','/drills','/build-a-rep','/library','/progress','/leaderboard','/friends','/settings','/achievements','/onboarding','/compare','/tutorial','/admin','/dev','/ops','/report','/scenario','/validate'];
  var inApp = appPrefixes.some(function(p){return path === p || path.indexOf(p + '/') === 0;});
  if (!inApp) { document.documentElement.classList.remove('dark'); return; }
  var stored = null;
  try { stored = localStorage.getItem('cognify:theme'); } catch(e) {}
  var dark = false;
  if (stored === 'dark') dark = true;
  else if (stored === 'system') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (dark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Cognify" />
        {APPLE_SPLASH.map((s) => (
          <link
            key={s.href}
            rel="apple-touch-startup-image"
            href={s.href}
            media={s.media}
          />
        ))}
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
