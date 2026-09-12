/**
 * @jest-environment node
 *
 * Tests for `lib/rate-limit.ts` — the Redis-backed fixed window with the
 * original in-memory token bucket behind it.
 *
 * The point of most of these is the FALLBACK. `REDIS_URL` unset is a supported
 * state (production does not have Redis yet, and a fresh clone has nothing on
 * 6379), and a Redis that is present but broken must not be able to reject a
 * request — a limiter that fails closed would turn one unreachable counter into
 * a 429 on payments initialisation and on the anonymous support chat. That is
 * the property worth a regression test; the happy path is one EVAL.
 *
 * `ioredis` is mocked throughout. A test suite that needed a live Redis would
 * be skipped in CI within a week, at which point it would be testing nothing.
 */

/* ── ioredis double ───────────────────────────────────────────────────────── */

/** Swapped per test. Declared before the factory *runs*, which is at require. */
let evalImpl: (...args: unknown[]) => Promise<unknown> = () =>
  Promise.reject(new Error("evalImpl was not configured by this test"));

const evalCalls: unknown[][] = [];
const constructed: Array<{ url: string; options: Record<string, unknown> }> = [];
const errorListeners: Array<(error: unknown) => void> = [];

/**
 * The factory closes over the three collectors above rather than defining them
 * inside itself, because `jest.resetModules()` re-runs it. State that must
 * survive a reset — the assertions read it after the fresh module has been
 * exercised — has to live in the test file's scope, not the factory's.
 */
jest.mock("ioredis", () => ({
  Redis: class MockRedis {
    constructor(url: string, options: Record<string, unknown>) {
      constructed.push({ url, options });
    }
    eval(...args: unknown[]): Promise<unknown> {
      evalCalls.push(args);
      return evalImpl(...args);
    }
    on(event: string, handler: (error: unknown) => void): this {
      if (event === "error") errorListeners.push(handler);
      return this;
    }
  },
}));

/* ── Harness ──────────────────────────────────────────────────────────────── */

type RateLimitModule = typeof import("@/lib/rate-limit");

/**
 * A fresh limiter, with fresh in-memory buckets, a fresh cooldown and a fresh
 * log throttle.
 *
 * `lib/redis.ts` deliberately caches its client on `globalThis` so that HMR in
 * dev does not leak a socket per reload. Jest gives each test FILE its own
 * module registry but not its own `globalThis`, so `jest.resetModules()` alone
 * would hand the next test the previous test's client. Deleting the key is the
 * other half of the reset.
 */
async function freshLimiter(redisUrl?: string): Promise<RateLimitModule> {
  jest.resetModules();
  delete (globalThis as { __echoRedis?: unknown }).__echoRedis;

  if (redisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = redisUrl;

  return import("@/lib/rate-limit");
}

/** Count `n` requests against one key and return each `ok`. */
async function consume(
  mod: RateLimitModule,
  key: string,
  n: number,
  opts: { limit: number; windowMs: number }
): Promise<boolean[]> {
  const results: boolean[] = [];
  for (let i = 0; i < n; i++) results.push((await mod.rateLimit(key, opts)).ok);
  return results;
}

const originalRedisUrl = process.env.REDIS_URL;
/* Typed rather than a bare `jest.SpyInstance`, whose `mock.calls` are `any[]` —
   and one of the assertions below is specifically about the TYPE of a logged
   argument, which `any` would quietly make vacuous. */
let warnSpy: jest.SpyInstance<void, unknown[]>;

beforeEach(() => {
  evalCalls.length = 0;
  constructed.length = 0;
  errorListeners.length = 0;
  /* The fallback path logs by design. Silencing it keeps the suite readable and
     lets the throttle itself be asserted. */
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

afterAll(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

/* ── No Redis configured ──────────────────────────────────────────────────── */

describe("rateLimit with REDIS_URL unset", () => {
  it("allows exactly `limit` requests and then rejects", async () => {
    const mod = await freshLimiter();

    const results = await consume(mod, "chat:1.2.3.4", 5, {
      limit: 3,
      windowMs: 60_000,
    });

    expect(results).toEqual([true, true, true, false, false]);
  });

  it("reports remaining and a reset in the future", async () => {
    const mod = await freshLimiter();

    const first = await mod.rateLimit("promo:user-1", { limit: 2, windowMs: 60_000 });
    expect(first).toMatchObject({ ok: true, remaining: 1 });
    expect(first.resetAt).toBeGreaterThan(Date.now());

    const second = await mod.rateLimit("promo:user-1", { limit: 2, windowMs: 60_000 });
    expect(second).toMatchObject({ ok: true, remaining: 0 });

    const third = await mod.rateLimit("promo:user-1", { limit: 2, windowMs: 60_000 });
    expect(third.ok).toBe(false);
  });

  it("counts each key independently", async () => {
    const mod = await freshLimiter();
    const opts = { limit: 1, windowMs: 60_000 };

    expect((await mod.rateLimit("set-role:a", opts)).ok).toBe(true);
    expect((await mod.rateLimit("set-role:a", opts)).ok).toBe(false);
    /* A different caller is not punished for the first one's traffic — the bug
       this guards is a key built without the client identifier in it. */
    expect((await mod.rateLimit("set-role:b", opts)).ok).toBe(true);
  });

  it("lets the caller through again once the window has elapsed", async () => {
    const mod = await freshLimiter();
    /* A real elapsed window rather than fake timers: the limiter reads
       `Date.now()` and also races a `setTimeout` on the Redis path, so a mocked
       clock is more machinery than a 60ms sleep is worth. Oversleeping is
       harmless here — the assertion only needs `windowMs` to have passed. */
    const opts = { limit: 1, windowMs: 40 };

    expect((await mod.rateLimit("chat:window", opts)).ok).toBe(true);
    expect((await mod.rateLimit("chat:window", opts)).ok).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect((await mod.rateLimit("chat:window", opts)).ok).toBe(true);
  });

  it("never constructs a Redis client", async () => {
    const mod = await freshLimiter();
    await mod.rateLimit("chat:no-redis", { limit: 5, windowMs: 60_000 });

    /* Not merely "no commands sent": an ioredis client that is constructed at
       all installs a reconnect timer. Unconfigured Redis must cost nothing. */
    expect(constructed).toHaveLength(0);
    expect(evalCalls).toHaveLength(0);
  });
});

/* ── Redis configured and healthy ─────────────────────────────────────────── */

describe("rateLimit with a healthy Redis", () => {
  /** Stand-in for the Lua script: increments, reports a full remaining TTL. */
  function countingEval(windowMs: number) {
    let count = 0;
    return () => {
      count += 1;
      return Promise.resolve([count, windowMs]);
    };
  }

  it("issues ONE EVAL per check, with the namespaced key and the window in ms", async () => {
    evalImpl = countingEval(60_000);
    const mod = await freshLimiter("redis://localhost:6379");

    await mod.rateLimit("pay-init:auth0|abc", { limit: 10, windowMs: 60_000 });

    /* One round trip is the whole justification for the fixed window over a
       sliding one — see the comment in lib/rate-limit.ts. */
    expect(evalCalls).toHaveLength(1);
    const [script, numKeys, key, windowMs] = evalCalls[0]!;
    expect(String(script)).toContain("INCR");
    expect(String(script)).toContain("PEXPIRE");
    expect(numKeys).toBe(1);
    expect(key).toBe("rl:pay-init:auth0|abc");
    expect(windowMs).toBe(60_000);
  });

  it("attaches an error listener to the client", async () => {
    evalImpl = countingEval(60_000);
    const mod = await freshLimiter("redis://localhost:6379");
    await mod.rateLimit("pay-init:listener", { limit: 10, windowMs: 60_000 });

    /* An ioredis client with no `error` listener turns a connection refusal
       into an unhandled `error` event, which escapes as an uncaughtException
       and poisons the Next render worker. See lib/redis.ts. */
    expect(errorListeners).toHaveLength(1);
  });

  it("connects lazily, with a short timeout and few retries", async () => {
    evalImpl = countingEval(60_000);
    const mod = await freshLimiter("redis://localhost:6379");
    await mod.rateLimit("pay-init:opts", { limit: 10, windowMs: 60_000 });

    expect(constructed).toHaveLength(1);
    const { url, options } = constructed[0]!;
    expect(url).toBe("redis://localhost:6379");
    expect(options.lazyConnect).toBe(true);
    /* A dev machine with nothing on 6379 must not hold a request for ioredis's
       10s default. */
    expect(options.connectTimeout).toBeLessThanOrEqual(2_000);
    expect(options.maxRetriesPerRequest).toBeLessThanOrEqual(1);
    /* Disabling the offline queue looks like fail-fast and is a total outage:
       with lazyConnect the first command is the one that triggers the connect,
       and it can only be delivered from the queue. */
    expect(options.enableOfflineQueue).toBe(true);
  });

  it("maps the script's count and TTL onto ok/remaining/resetAt", async () => {
    evalImpl = countingEval(30_000);
    const mod = await freshLimiter("redis://localhost:6379");
    const opts = { limit: 3, windowMs: 30_000 };

    const first = await mod.rateLimit("promo:redis", opts);
    expect(first).toMatchObject({ ok: true, remaining: 2 });
    expect(first.resetAt).toBeGreaterThan(Date.now());

    expect(await mod.rateLimit("promo:redis", opts)).toMatchObject({
      ok: true,
      remaining: 1,
    });
    expect(await mod.rateLimit("promo:redis", opts)).toMatchObject({
      ok: true,
      remaining: 0,
    });

    /* The fourth request is count 4 against limit 3. `remaining` is clamped at
       zero: the counter keeps climbing under abuse, and a negative remaining
       would leak that straight into a response header. */
    expect(await mod.rateLimit("promo:redis", opts)).toMatchObject({
      ok: false,
      remaining: 0,
    });
  });

  it("does not consult the in-memory bucket while Redis is answering", async () => {
    evalImpl = () => Promise.resolve([1, 60_000]);
    const mod = await freshLimiter("redis://localhost:6379");
    const opts = { limit: 1, windowMs: 60_000 };

    /* Redis reports "first request in the window" every time, so a limiter that
       also decremented a local bucket would start rejecting. Redis is the
       authority when it is up; the bucket is only the fallback. */
    const results = await consume(mod, "chat:authority", 4, opts);
    expect(results).toEqual([true, true, true, true]);
  });
});

/* ── Redis configured and failing: the property that matters ───────────────── */

describe("rateLimit with a failing Redis", () => {
  /** The real shape of a refused local connection: both ::1 and 127.0.0.1. */
  function refusedConnection(): AggregateError {
    return new AggregateError([
      new Error("connect ECONNREFUSED ::1:6379"),
      new Error("connect ECONNREFUSED 127.0.0.1:6379"),
    ]);
  }

  it("resolves through the in-memory bucket instead of rejecting", async () => {
    evalImpl = () => Promise.reject(refusedConnection());
    const mod = await freshLimiter("redis://localhost:6379");

    /* FAIL OPEN. The alternative — treating a Redis error as "over the limit" —
       would 429 payments initialisation and the anonymous support chat on a
       counter being unreachable. */
    await expect(
      mod.rateLimit("pay-init:down", { limit: 10, windowMs: 60_000 })
    ).resolves.toMatchObject({ ok: true });
  });

  it("falls back to the bucket's limits, not to allowing everything", async () => {
    evalImpl = () => Promise.reject(refusedConnection());
    const mod = await freshLimiter("redis://localhost:6379");

    const results = await consume(mod, "chat:down", 5, { limit: 3, windowMs: 60_000 });

    /* Fail open means "degrade to per-instance", not "stop limiting". */
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("survives a non-Error rejection and a malformed reply", async () => {
    evalImpl = () => Promise.reject("NOAUTH Authentication required.");
    let mod = await freshLimiter("redis://localhost:6379");
    await expect(
      mod.rateLimit("promo:noauth", { limit: 2, windowMs: 60_000 })
    ).resolves.toMatchObject({ ok: true });

    /* A reply of the wrong shape is as much a failure as a rejection, and it
       must not become `NaN` remaining or an `undefined` resetAt. */
    evalImpl = () => Promise.resolve("OK");
    mod = await freshLimiter("redis://localhost:6379");
    const result = await mod.rateLimit("promo:garbage", { limit: 2, windowMs: 60_000 });
    expect(result.ok).toBe(true);
    expect(Number.isFinite(result.remaining)).toBe(true);
    expect(Number.isFinite(result.resetAt)).toBe(true);
  });

  it("stops asking Redis after a failure, so an outage is not a latency outage", async () => {
    evalImpl = () => Promise.reject(refusedConnection());
    const mod = await freshLimiter("redis://localhost:6379");

    await consume(mod, "chat:cooldown", 20, { limit: 30, windowMs: 60_000 });

    /* Without the cooldown every metered request pays the Redis timeout before
       falling back, which couples payments latency to Redis health — exactly
       what the fallback exists to prevent. */
    expect(evalCalls).toHaveLength(1);
  });

  it("logs the failure once, not once per request", async () => {
    evalImpl = () => Promise.reject(refusedConnection());
    const mod = await freshLimiter("redis://localhost:6379");

    await consume(mod, "chat:flood", 50, { limit: 100, windowMs: 60_000 });

    /* A Redis outage must not bury the rest of the log. */
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("flattens an AggregateError to a string before logging it", async () => {
    evalImpl = () => Promise.reject(refusedConnection());
    const mod = await freshLimiter("redis://localhost:6379");
    await mod.rateLimit("chat:aggregate", { limit: 5, windowMs: 60_000 });

    /**
     * This is the `lib/directory.ts` bug, in Redis form. Handing an
     * `AggregateError` to `console.warn` inside a Next server render makes the
     * dev server's serialiser drop the `errors` array and reconstruct
     * `new AggregateError(null)`, which throws `TypeError: object null is not
     * iterable` — an uncatchable throw that turned an 8ms connection refusal
     * into `GET / 500 in 2.2min`.
     *
     * So the assertion is about the TYPE of the argument, not the wording: one
     * string, no error object anywhere in the call.
     */
    const args = warnSpy.mock.calls[0]!;
    expect(args).toHaveLength(1);
    expect(typeof args[0]).toBe("string");
    expect(args[0]).toContain("ECONNREFUSED");
    expect(args.some((arg) => arg instanceof Error)).toBe(false);
  });
});

/* ── clientIp ─────────────────────────────────────────────────────────────── */

describe("clientIp", () => {
  function requestWith(headers: Record<string, string>): Request {
    return {
      headers: { get: (name: string) => headers[name] ?? null },
    } as unknown as Request;
  }

  it("stays synchronous", async () => {
    const mod = await freshLimiter();
    /* `rateLimit` became async; `clientIp` reads two headers and touches no
       I/O, so it deliberately did not. Every call site interpolates it
       directly into the key — `clientIp(req)` returning a Promise would
       silently key every limit on "[object Promise]", collapsing all callers
       onto one bucket. */
    expect(mod.clientIp(requestWith({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("prefers the leftmost x-forwarded-for entry", async () => {
    const mod = await freshLimiter();
    expect(
      mod.clientIp(
        requestWith({
          "x-forwarded-for": " 203.0.113.7 , 70.41.3.18 ",
          "x-real-ip": "9.9.9.9",
        })
      )
    ).toBe("203.0.113.7");
  });

  it("falls back to a constant rather than throwing when nothing is set", async () => {
    const mod = await freshLimiter();
    /* All un-proxied callers share one bucket under this key. Acceptable: it is
       a fallback for a misconfigured edge, not the normal path. */
    expect(mod.clientIp(requestWith({}))).toBe("unknown");
  });
});
