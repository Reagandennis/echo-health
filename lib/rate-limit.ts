/**
 * In-memory token-bucket rate limiter.
 *
 * Suitable as defense-in-depth on a warm serverless instance — does NOT
 * provide hard guarantees across instances. For production-grade limits,
 * front this with Vercel WAF, Cloudflare, or a shared store (Upstash, Redis).
 */

type Bucket = { tokens: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Number of requests allowed in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Consume one token from `key`'s bucket. Returns `{ ok: false }` when the
 * caller has exceeded `limit` requests in the last `windowMs`.
 *
 * The key should combine the route name with a stable client identifier
 * (e.g. authenticated user id, falling back to client IP).
 */
export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    buckets.set(key, { tokens: opts.limit - 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt };
  }

  if (existing.tokens <= 0) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.tokens -= 1;
  return { ok: true, remaining: existing.tokens, resetAt: existing.resetAt };
}

/**
 * Extract a best-effort client identifier from a Next.js request.
 * Uses the leftmost x-forwarded-for entry (Vercel/Cloudflare populate it).
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
