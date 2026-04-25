import { unstable_cache } from "next/cache";

/**
 * Fetch the og:image (or twitter:image fallback) for a URL.
 *
 * Returns the resolved absolute URL of the article's preview image, or null
 * if the page doesn't expose one or the fetch fails. Cached for 7 days via
 * Next.js Data Cache so we don't re-hit external sites every render.
 */
async function fetchOgImageInner(articleUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(articleUrl);
  } catch {
    return null;
  }

  // Skip known video hosts — `thumbnailFor()` already handles them.
  if (
    parsed.hostname.includes("youtube.com") ||
    parsed.hostname === "youtu.be" ||
    parsed.hostname.includes("ted.com")
  ) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(articleUrl, {
      signal: controller.signal,
      headers: {
        // Some sites serve different markup to bots; identify as a real browser.
        "User-Agent":
          "Mozilla/5.0 (compatible; CognifyLibraryBot/1.0; +https://cognifygym.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
      return null;
    }

    // Read at most 256KB — og tags are always in <head>, no need for the body.
    const reader = res.body?.getReader();
    if (!reader) return null;
    let html = "";
    let total = 0;
    const decoder = new TextDecoder();
    while (total < 256 * 1024) {
      const { value, done } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      total += value.byteLength;
      if (html.includes("</head>")) break;
    }
    try {
      reader.cancel();
    } catch {
      // ignore
    }

    const ogMatch =
      html.match(
        /<meta\s+(?:[^>]*?\s+)?property=["']og:image(?::secure_url)?["'][^>]*?\s+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta\s+(?:[^>]*?\s+)?content=["']([^"']+)["'][^>]*?\s+property=["']og:image(?::secure_url)?["']/i,
      ) ??
      html.match(
        /<meta\s+(?:[^>]*?\s+)?name=["']twitter:image["'][^>]*?\s+content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta\s+(?:[^>]*?\s+)?content=["']([^"']+)["'][^>]*?\s+name=["']twitter:image["']/i,
      );

    if (!ogMatch || !ogMatch[1]) return null;

    // Resolve relative URLs against the article origin.
    try {
      return new URL(ogMatch[1], parsed.origin).toString();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Cached wrapper. 7-day revalidate. Cache key is the URL itself.
 */
export const getOgImageUrl = unstable_cache(
  async (articleUrl: string) => fetchOgImageInner(articleUrl),
  ["library-og-image"],
  { revalidate: 60 * 60 * 24 * 7 },
);

/**
 * Pull a small favicon for an article's domain. Used as a source-identity
 * mark on the typographic hero card. Google's favicon service is reliable
 * for any public domain and doesn't require a fetch from us.
 */
export function faviconForUrl(articleUrl: string, size = 32): string | null {
  try {
    const u = new URL(articleUrl);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=${size}`;
  } catch {
    return null;
  }
}
