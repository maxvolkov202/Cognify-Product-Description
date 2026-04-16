import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for expensive API routes (Claude, Deepgram, blob upload).
 *
 * **Degrades gracefully**: without `UPSTASH_REDIS_REST_URL` +
 * `UPSTASH_REDIS_REST_TOKEN`, rate limiting is a no-op and every
 * request is allowed. This keeps local dev friction-free while
 * production deployments get real limits — just set the two env vars.
 *
 * **Free tier**: Upstash gives 10K commands/day free. For a consumer
 * product doing ~30 API calls per active user per day, that's ~300
 * free active users per day with zero cost. Plenty for MVP.
 *
 * Setup:
 *   1. https://upstash.com → Create Redis DB (free tier)
 *   2. REST API tab → copy URL + token
 *   3. Add to .env.local:
 *        UPSTASH_REDIS_REST_URL=https://...
 *        UPSTASH_REDIS_REST_TOKEN=...
 *   4. Restart dev server
 */

function hasUpstash(): boolean {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

type Window =
  | `${number} ms`
  | `${number} s`
  | `${number} m`
  | `${number} h`
  | `${number} d`;

// Lazy-initialized limiter cache. We don't touch Redis at module load
// because the limiter is constructed per (count, window) combination.
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(count: number, window: Window): Ratelimit | null {
  if (!hasUpstash()) return null;
  const cacheKey = `${count}:${window}`;
  const existing = limiterCache.get(cacheKey);
  if (existing) return existing;
  try {
    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(count, window),
      prefix: "cognify:rl",
      analytics: false,
    });
    limiterCache.set(cacheKey, limiter);
    return limiter;
  } catch (err) {
    // Upstash misconfigured or unreachable — fail open
    console.warn(
      "[ratelimit] Redis init failed, disabling rate limits:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

/**
 * Check if a request from `identifier` should be allowed.
 *
 * Default quota: 20 requests per minute per identifier — generous for
 * normal workout flow (<5 req/min) but catches runaway loops that
 * would otherwise burn the Anthropic account.
 *
 * Returns `allowed: true` with infinite remaining when rate limiting
 * is not configured (graceful degradation).
 */
// In-memory sliding window fallback for when Upstash isn't configured.
// Per-instance (not global across serverless invocations), but catches
// rapid-fire abuse from the same client within a warm function.
const memBuckets = new Map<string, number[]>();

function memoryRateLimit(
  identifier: string,
  maxCount: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${maxCount}:${windowMs}`;
  let timestamps = memBuckets.get(key);
  if (!timestamps) {
    timestamps = [];
    memBuckets.set(key, timestamps);
  }
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) timestamps.shift();
  if (timestamps.length >= maxCount) {
    return { allowed: false, remaining: 0, reset: now + windowMs };
  }
  timestamps.push(now);
  return { allowed: true, remaining: maxCount - timestamps.length, reset: now + windowMs };
}

function parseWindowMs(w: Window): number {
  const [, num, unit] = w.match(/^(\d+)\s*(ms|s|m|h|d)$/) ?? [];
  const n = parseInt(num ?? "1", 10);
  switch (unit) {
    case "ms": return n;
    case "s": return n * 1000;
    case "m": return n * 60_000;
    case "h": return n * 3_600_000;
    case "d": return n * 86_400_000;
    default: return 60_000;
  }
}

export async function rateLimit(
  identifier: string,
  opts: {
    count?: number;
    window?: Window;
  } = {},
): Promise<RateLimitResult> {
  const count = opts.count ?? 20;
  const window = opts.window ?? "1 m";
  const limiter = getLimiter(count, window);
  if (!limiter) {
    return memoryRateLimit(identifier, count, parseWindowMs(window));
  }
  try {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (err) {
    // Redis network failure at request time — fail open (allow request)
    // to avoid a degraded Redis taking down the whole product.
    console.warn(
      "[ratelimit] check failed, allowing request:",
      err instanceof Error ? err.message : err,
    );
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, reset: 0 };
  }
}

/**
 * Extract the rate-limit identifier from an incoming request. Prefers
 * the real client IP from common proxy headers; falls back to
 * 'anonymous' which is shared across all anonymous clients (a
 * somewhat pessimistic floor that still catches abuse).
 */
export function getRateLimitIdentifier(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "anonymous";
}
