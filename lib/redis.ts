import { Redis } from "ioredis";

/**
 * Redis — an OPTIONAL dependency.
 *
 * `REDIS_URL` unset is a fully supported state, not a degraded one. Production
 * on Azure does not have a Redis instance yet, and a fresh clone of this repo
 * has nothing listening on 6379, so every caller must work identically with
 * `getRedis()` returning `null`. Nothing in the app may hard-depend on this
 * module: today its only consumer is `lib/rate-limit.ts`, which treats Redis as
 * an upgrade (cross-instance counters) over a fallback that already works.
 *
 * Contrast `lib/db/index.ts`, which THROWS when its connection string is
 * missing. That asymmetry is deliberate: Postgres holds the product, and an app
 * that starts without it would serve empty pages that look like real ones.
 * Redis holds a counter.
 */

/**
 * ## Why there is an `error` listener, and why it never logs the error OBJECT
 *
 * Both halves of this are load-bearing, and both were learned the hard way in
 * `lib/directory.ts` — read the long comment there, the failure mode is the
 * same one and it is worth understanding before touching this file.
 *
 * 1. **An ioredis client with no `error` listener is a crash.** `error` is an
 *    EventEmitter event, and an unhandled one throws. A connection refusal is
 *    then no longer a handled, recoverable condition in the rate limiter's
 *    `catch` — it escapes as an `uncaughtException` on a later tick, outside
 *    any promise this module holds, and poisons the Next.js render worker.
 *
 * 2. **The error must be flattened to a string before logging.** When nothing
 *    is listening on 6379, Node resolves `localhost` to both `::1` and
 *    `127.0.0.1`, both refuse, and ioredis emits an `AggregateError`. Handing
 *    that object to `console.error` inside a Next server render makes the dev
 *    server's error serialiser drop the `errors` array and then reconstruct
 *    `new AggregateError(null)`, which throws `TypeError: object null is not
 *    iterable`. That throw is uncatchable from application code.
 *
 * Together these are exactly how a caught, handled, 8-millisecond connection
 * refusal became `GET / 500 in 2.2min` earlier in this project's history. The
 * database's version of this bug is fixed; do not reintroduce Redis's.
 */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = (error.errors ?? [])
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .join("; ");
    return `AggregateError(${error.message || "no message"})${causes ? `: ${causes}` : ""}`;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

/**
 * How often a Redis failure may be logged, across every source.
 *
 * A Redis that is down does not fail once. ioredis re-emits `error` on every
 * reconnection attempt, and every request that reaches the limiter adds its own
 * failure — so an unthrottled log turns a Redis outage into a log flood that
 * buries whatever else the process was trying to tell you. One line a minute is
 * enough to notice, and the fallback means nothing is actually broken.
 */
const LOG_INTERVAL_MS = 60_000;

let lastLoggedAt = 0;

/**
 * Log a Redis failure at most once per `LOG_INTERVAL_MS`.
 *
 * The throttle is shared rather than per-call-site on purpose: one unreachable
 * Redis is ONE fact, however many code paths trip over it.
 *
 * Warn, not error: by design Redis being gone is a supported state that
 * degrades a cross-instance counter to a per-instance one. It should be visible
 * (an operator reading "rate limits are per-instance" may want to act) without
 * claiming the app is failing, because it is not.
 */
export function logRedisFailure(context: string, error: unknown): void {
  const now = Date.now();
  if (now - lastLoggedAt < LOG_INTERVAL_MS) return;
  lastLoggedAt = now;
  console.warn(
    `[redis] ${context}: ${describeError(error)} — ` +
      `falling back to in-memory behaviour. Further Redis failures will be ` +
      `logged at most once every ${LOG_INTERVAL_MS / 1000}s.`
  );
}

/**
 * Cached across hot reloads, for the same reason `lib/db/index.ts` caches its
 * Postgres pool: without this, every HMR pass in dev constructs a fresh client
 * and leaks the old one's socket and reconnect timer. Postgres runs out of
 * connections; Redis instead accumulates clients that each keep retrying
 * forever, which shows up as a dev server that gets slower and noisier the
 * longer you work in it.
 *
 * `null` is a legitimate cached value ("REDIS_URL is unset"), so the sentinel
 * for "not yet resolved" has to be `undefined`, not falsiness.
 */
const globalForRedis = globalThis as unknown as {
  __echoRedis?: Redis | null;
};

let resolved: Redis | null | undefined = globalForRedis.__echoRedis;

function createClient(url: string): Redis | null {
  try {
    const client = new Redis(url, {
      /**
       * No socket is opened until the first command. This keeps the cost of
       * importing this module at zero, which matters because it is reached from
       * request paths that may never need Redis (a 401 short-circuits before
       * the limiter on several routes).
       */
      lazyConnect: true,

      /**
       * Short. The whole point of a rate-limit check is that it is cheap; a
       * developer with no Redis running must not pay ioredis's 10s default
       * before their request proceeds. `lib/db/index.ts` deliberately uses a
       * GENEROUS 30s connect timeout for the opposite reason — Azure's TLS
       * handshake alone is ~1.7s and aborting it would fail connections that
       * were about to succeed. Redis here is local or same-region, and
       * optional, so the trade runs the other way.
       */
      connectTimeout: 2_000,

      /**
       * Fail the command, don't wait for the cluster to come back. With the
       * default (20) a request issued during an outage sits in the offline
       * queue through twenty reconnect attempts. One attempt is enough: the
       * caller has a working fallback, so a fast rejection is strictly better
       * than a slow success.
       */
      maxRetriesPerRequest: 1,

      /**
       * Keep reconnecting, with a capped backoff.
       *
       * Returning `null` here would end the client permanently, which is
       * tempting ("stop bothering an absent Redis") and wrong: the process is
       * long-lived — AGENTS.md requires it, for LISTEN/NOTIFY — so a client
       * that gave up at startup would stay given-up for the life of the
       * deployment, and a Redis that came back an hour later would never be
       * picked up without a restart.
       */
      retryStrategy: (attempt: number) => Math.min(attempt * 200, 5_000),

      /**
       * The offline queue stays ON (this is ioredis's default; it is spelled
       * out because disabling it looks like a fail-fast improvement and is
       * actually a total outage).
       *
       * With `lazyConnect`, the FIRST command is what triggers the connect, and
       * it can only be delivered by being queued until the socket is ready.
       * With `enableOfflineQueue: false` that first command is rejected with
       * "Stream isn't writeable", so Redis would appear permanently broken even
       * when it is healthy. `maxRetriesPerRequest` above is what bounds the
       * queue's wait, not this flag.
       */
      enableOfflineQueue: true,
    });

    /* See the long comment above: the listener must exist, and it must not be
       handed the error object. */
    client.on("error", (error: unknown) => {
      logRedisFailure("connection error", error);
    });

    return client;
  } catch (error) {
    /**
     * `new Redis()` throws synchronously on an unparseable connection string.
     * A typo in `REDIS_URL` is a configuration mistake, not a reason to take
     * the app down — the limiter degrades to in-memory and says so once.
     */
    logRedisFailure("REDIS_URL could not be parsed", error);
    return null;
  }
}

/**
 * The shared Redis client, or `null` when Redis is not configured.
 *
 * Resolved on first call rather than at module load so that `null` is reached
 * without ever constructing a client, and so tests can exercise both states by
 * resetting the module registry.
 *
 * Callers must handle `null` and must not assume a non-null client is
 * CONNECTED — `lazyConnect` means the socket may not exist yet, and the
 * command itself is where an unreachable server surfaces.
 */
export function getRedis(): Redis | null {
  if (resolved !== undefined) return resolved;

  const url = process.env.REDIS_URL;
  resolved = url ? createClient(url) : null;

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.__echoRedis = resolved;
  }
  return resolved;
}
