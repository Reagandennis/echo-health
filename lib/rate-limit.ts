import { getRedis, logRedisFailure } from "@/lib/redis";

/**
 * Rate limiting, shared across instances when Redis is available.
 *
 * Two implementations live here and they are not the same algorithm:
 *
 *  - **Redis (preferred)** — a fixed window, counted with one atomic EVAL. All
 *    app instances share the counter, so the limit is the limit.
 *  - **In-memory (fallback)** — the original token bucket, per process. Used
 *    when `REDIS_URL` is unset (a supported state — see `lib/redis.ts`) and
 *    whenever Redis fails.
 *
 * Neither is a security control. These limits sit in front of payments
 * initialisation, role assignment, promo validation and the anonymous support
 * chat as defense-in-depth; the real guards on those routes are the auth and
 * ownership checks next to them. A hard guarantee belongs at the edge (Azure
 * Front Door / Cloudflare), which can reject abuse before it costs a request.
 */

/* ── Fixed window vs token bucket: what changes when Redis is on ──────────── */

/**
 * The Redis path is a FIXED WINDOW, not the token bucket below. Read this
 * before assuming the two paths behave identically, because they do not.
 *
 * A fixed window buckets time into `windowMs` slices keyed by the counter's
 * TTL, so **it admits up to 2× `limit` across a boundary**: 10 requests in the
 * last instant of one window and 10 more in the first instant of the next is 20
 * requests in a few milliseconds against `limit: 10`. A sliding window or a
 * distributed token bucket does not have that edge.
 *
 * That is an accepted trade here, and the reason is round trips. A fixed window
 * is ONE `EVAL` — a single network hop on the critical path of every metered
 * request. A sliding-window log needs a sorted set, a range trim and a count; a
 * distributed token bucket needs the last-refill timestamp read, computed and
 * written back. Both are more code and more latency to defend a 2× burst on
 * routes where 2× is irrelevant: 20 promo validations instead of 10 is not an
 * incident, and the ownership check still runs on every one of them.
 *
 * If a route ever needs a limit where the boundary burst actually matters —
 * anything that costs money per call, or anything that would be a
 * denial-of-service at 2× — it needs a different algorithm, not a smaller
 * number here.
 */

/**
 * ## Why the Redis path is a script and not `INCR` + `EXPIRE`
 *
 * The obvious implementation is two commands:
 *
 *     const n = await redis.incr(key);
 *     if (n === 1) await redis.expire(key, windowSeconds);
 *
 * and it has a failure mode that does not heal. Those are two round trips with
 * a gap between them. If the process is killed in that gap — a deploy, an
 * autoscale event, an OOM, a Redis failover that drops the connection — the key
 * exists with **no TTL at all**. `INCR` creates it without expiry and nothing
 * ever comes back to set one. From then on the counter only grows, and the
 * caller that key belongs to is rate-limited *permanently*, until somebody
 * notices and deletes the key by hand.
 *
 * For an IP-keyed limit that is a stranger locked out of the support chat
 * forever, with no error anywhere to explain it.
 *
 * A single `EVAL` closes the gap: Redis runs the whole script atomically on one
 * connection, so the increment and the expiry either both happen or neither
 * does. It also returns the count and the remaining TTL together, which is what
 * lets the whole check be one hop rather than an `INCR` followed by a `PTTL`.
 */
const FIXED_WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  return {count, tonumber(ARGV[1])}
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  -- Unreachable via this script (that is the point of it), but a key of any
  -- other provenance -- a stray redis-cli INCR, a namespace collision with
  -- another tenant of the same Redis -- would otherwise block its owner
  -- forever. Re-arm the expiry rather than inherit a permanent lockout.
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
`;

/**
 * Namespaced so this cannot collide with anything else sharing the instance.
 * `rl:` is short on purpose — the key is sent on every metered request.
 */
function redisKey(key: string): string {
  return `rl:${key}`;
}

/**
 * A hard ceiling on how long a rate-limit check may take.
 *
 * `maxRetriesPerRequest: 1` in `lib/redis.ts` already bounds the wait in
 * ioredis's own terms, but that bound is expressed in reconnection attempts,
 * not milliseconds, and it says nothing about a server that accepts the
 * connection and then stops answering. This is the wall-clock bound, and it is
 * the same shape as the `Promise.race` in `lib/directory.ts`: the query is not
 * cancelled, we simply stop waiting for it.
 */
const REDIS_TIMEOUT_MS = 1_000;

/**
 * After a failure, stop asking Redis for this long.
 *
 * Without a cooldown, an unreachable Redis makes every single metered request
 * pay `REDIS_TIMEOUT_MS` before falling back — so a Redis outage becomes a
 * latency outage on payments and chat, which is precisely the coupling the
 * fallback exists to prevent. Ten seconds is short enough that a Redis coming
 * back is picked up almost immediately (the same reasoning, and the same
 * number, as the unreachable-database TTL in `lib/directory.ts`).
 */
const COOLDOWN_MS = 10_000;

let cooldownUntil = 0;

/* ── Public shape ─────────────────────────────────────────────────────────── */

export interface RateLimitOptions {
  /** Number of requests allowed in the window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
}

export interface RateLimitResult {
  readonly ok: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

/* ── In-memory fallback (the original token bucket, unchanged) ─────────────── */

type Bucket = { tokens: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Per-process token bucket. This is the pre-Redis implementation, kept verbatim
 * because it is the fallback, and a fallback that behaves differently from the
 * thing it replaces is a second bug waiting for an outage to reveal it.
 *
 * Note that a mid-window failover to this path starts the caller on a FRESH
 * bucket — their Redis count does not transfer. That is the fail-open choice
 * made explicit: a caller may briefly get more requests than the limit allows,
 * which is the correct direction to be wrong in (see `rateLimit`).
 */
function inMemoryRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
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

/* ── Redis path ───────────────────────────────────────────────────────────── */

/** Read `{ count, ttlMs }` out of the script's multi-bulk reply. */
function parseScriptReply(reply: unknown): { count: number; ttlMs: number } {
  if (!Array.isArray(reply) || reply.length < 2) {
    throw new Error(`unexpected EVAL reply: ${JSON.stringify(reply)}`);
  }
  const count = Number(reply[0]);
  const ttlMs = Number(reply[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error(`non-numeric EVAL reply: ${JSON.stringify(reply)}`);
  }
  return { count, ttlMs };
}

async function redisRateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult | null> {
  if (Date.now() < cooldownUntil) return null;

  const redis = getRedis();
  if (!redis) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reply = await Promise.race([
      redis.eval(FIXED_WINDOW_SCRIPT, 1, redisKey(key), opts.windowMs),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`EVAL timed out after ${REDIS_TIMEOUT_MS}ms`)),
          REDIS_TIMEOUT_MS
        );
      }),
    ]);

    const { count, ttlMs } = parseScriptReply(reply);
    return {
      ok: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      resetAt: Date.now() + ttlMs,
    };
  } catch (error) {
    /**
     * FAIL OPEN. Returning `null` hands the decision to the in-memory bucket
     * rather than rejecting the request.
     *
     * The alternative — treating a Redis error as "over the limit" — makes
     * Redis a hard dependency of every metered route by the back door: one
     * unreachable counter would 429 payments initialisation, role assignment
     * and the whole support chat, including the anonymous visitor who has no
     * account and no way to report it. A rate limiter is defense-in-depth on
     * these routes; the authorisation checks beside it are not, and they still
     * run. An attacker gets a per-instance limit instead of a global one for a
     * few seconds, which is where the code started.
     *
     * Logging is throttled in `lib/redis.ts` — a Redis outage must not become a
     * log flood — and the error is flattened to a string there rather than
     * passed as an object, which matters more than it looks: see that file.
     */
    logRedisFailure(`rate-limit EVAL failed for ${redisKey(key)}`, error);
    cooldownUntil = Date.now() + COOLDOWN_MS;
    return null;
  } finally {
    /* Without this the timer holds the event loop open for a second after every
       successful check, which in dev is a server that will not exit on Ctrl-C.
       Same trap as `lib/directory.ts`. */
    if (timer) clearTimeout(timer);
  }
}

/* ── Entry points ─────────────────────────────────────────────────────────── */

/**
 * Count one request against `key`. Returns `{ ok: false }` when the caller has
 * exceeded `limit` requests in the last `windowMs`.
 *
 * The key should combine the route name with a stable client identifier
 * (e.g. authenticated user id, falling back to client IP).
 *
 * Async because the shared counter lives in Redis. It never rejects: every
 * Redis failure resolves through the in-memory fallback, so callers do not need
 * a try/catch and a `catch` that swallowed one would be hiding nothing.
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions
): Promise<RateLimitResult> {
  return (await redisRateLimit(key, opts)) ?? inMemoryRateLimit(key, opts);
}

/**
 * Extract a best-effort client identifier from a Next.js request.
 * Uses the leftmost x-forwarded-for entry (Vercel/Cloudflare populate it).
 *
 * Stays synchronous: it reads two headers and touches no I/O, so making it
 * `async` would only force `await` on every call site for nothing.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
