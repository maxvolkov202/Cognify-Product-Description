import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3333"),
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
    title: "Cognify — The Duolingo for communication",
    description:
      "Short, structured reps. Instant feedback. Measurable growth. Train clear thinking into clear speech.",
    siteName: "Cognify",
    type: "website",
    images: [
      {
        url: "/logo/wordmark.svg",
        width: 1200,
        height: 630,
        alt: "Cognify — the Duolingo for communication",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cognify",
    description: "The Duolingo for communication.",
    images: ["/logo/wordmark.svg"],
  },
  icons: {
    icon: [{ url: "/logo/mark.svg", type: "image/svg+xml" }],
    apple: "/logo/mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#9788ff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
