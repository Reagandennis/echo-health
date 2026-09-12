import net from "node:net";
import { and, desc, eq, sql } from "drizzle-orm";
import { therapists } from "@/lib/db/schema";
import { withAnonymous } from "@/lib/db/session";

/**
 * The public therapist directory.
 *
 * `therapists_select` is `USING (true)` in migration 0001 — the table is
 * deliberately world-readable, and AGENTS.md says why: visitors browse it
 * before signing in. Until now nothing used that: the home page rendered three
 * invented clinicians over stock photographs, and its "browse all" button
 * pointed at an anchor because, per the comment it carried, "browsing the full
 * roster requires an account". It does not.
 *
 * Reads run under `withAnonymous`, which sets no identity — correct here, and
 * the one place in the app where it is correct for a domain table.
 */

export interface DirectoryTherapist {
  readonly id: string;
  readonly name: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly experience: number;
  readonly specialties: readonly string[];
  readonly timezone: string;
  readonly sessionDurationMinutes: number;
}

/**
 * The gate for appearing publicly. BOTH conditions, always.
 *
 * `kyc_status = 'verified'` is the licence check; `onboarding_complete` means
 * they have actually finished setting up a profile. A verified therapist with
 * a half-written bio on a public page is worse than one fewer card, and an
 * unverified one on a public page is a claim we cannot stand behind.
 *
 * Expressed once, here, so the directory and the profile route cannot
 * disagree about it — a profile page that renders someone the directory hides
 * is a leak with a URL.
 */
const publiclyVisible = and(
  eq(therapists.kycStatus, "verified"),
  eq(therapists.onboardingComplete, true)
);

/**
 * Columns are listed explicitly rather than selecting the row.
 *
 * `therapists` carries `license_number`, `license_url`, `kyc_review_note` and
 * the reviewing admin's id, and RLS does not filter columns — a `SELECT *`
 * here would pull an applicant's licence number and the internal note written
 * about their application into a public page's props, where it would sit in
 * the server-rendered HTML whether or not anything rendered it.
 */
const publicColumns = {
  id: therapists.id,
  name: therapists.name,
  bio: therapists.bio,
  avatarUrl: therapists.avatarUrl,
  experience: therapists.experience,
  specialties: therapists.specialties,
  timezone: therapists.timezone,
  sessionDurationMinutes: therapists.sessionDurationMinutes,
};

/**
 * Every read below degrades to "nobody is listed" instead of throwing.
 *
 * These queries run in three places that all fail badly on an exception:
 * `generateStaticParams` for `/therapists/[id]`, the ISR render of
 * `/therapists`, and the home page's therapist strip.
 *
 * With the error propagating, an unreachable database does not produce a
 * degraded directory — it fails `next build` outright ("Failed to collect page
 * data for /therapists/[id]"), so a momentary database blip during a deploy
 * takes down the deploy of an otherwise entirely static marketing site. At
 * request time it is a 500 on the most-linked page on the site.
 *
 * The honest empty state already exists on `/therapists`, and the home page
 * omits its strip when the list is empty, so an empty result is a page that
 * still works. `revalidate = 300` means the real roster reappears within five
 * minutes of the database coming back, with no deploy.
 *
 * It is logged at `error` rather than swallowed: this must be loud in the
 * server logs, because "the directory is empty" and "the directory is broken"
 * look identical from the outside and only one of them needs a person.
 */
/**
 * How long a public page will wait for the database before giving up.
 *
 * These are marketing pages. A visitor who waits three seconds for a
 * therapist grid has already had a bad experience, and one who waits for
 * `connect_timeout` (30s in `lib/db/index.ts`, sized for Azure's ~1.7s
 * handshake) has left. The ISR window is five minutes, so a timed-out render
 * is retried shortly anyway.
 *
 * `Promise.race` does not cancel the query — it stops waiting for it. The
 * connection returns to the pool when it eventually settles. That is an
 * acceptable trade for one row on a marketing page; it would not be for a
 * write.
 */
const QUERY_TIMEOUT_MS = 3_000;

/* ── Reachability gate ───────────────────────────────────────────────────── */

/**
 * ## Why a TCP probe, and not just a try/catch
 *
 * A try/catch is not enough, and this was worth several hours to establish.
 *
 * When Postgres is not listening, Node resolves `localhost` to both `::1` and
 * `127.0.0.1`, both refuse, and Node's socket layer produces an
 * `AggregateError`. The query promise rejects with it and `safely()` below
 * catches it cleanly — you can see it do so in the log. But a SECOND throw
 * then escapes on a later tick, outside any promise this module holds:
 *
 *   ⨯ uncaughtException: TypeError: object null is not iterable
 *       (cannot read property Symbol(Symbol.iterator))
 *       at AggregateError (<anonymous>)
 *
 * That is Next's dev server reconstructing the `AggregateError` after its
 * serialiser has dropped the `errors` array — `new AggregateError(null)`
 * throws exactly this. It cannot be caught from application code, it poisons
 * the render worker, and the symptom is `GET / 500 in 2.2min` on a connection
 * that was actually refused in 8 milliseconds. Every marketing page that does
 * NOT touch the database served in ~150ms throughout.
 *
 * So the fix is to never open that socket when there is nothing behind it. A
 * raw `net.connect` is entirely under our control: it either connects or it
 * does not, it cannot produce an AggregateError, and it costs about a
 * millisecond locally.
 *
 * ## What this is NOT
 *
 * It is not a health check and it is not a circuit breaker for the app. It
 * guards the PUBLIC marketing pages only, which is the one place where "the
 * database is unavailable" should degrade to a quieter page rather than an
 * error. The authenticated portals still fail loudly, which is correct — a
 * therapist whose client list silently came back empty would be worse than one
 * who sees an error.
 */
const REACHABLE_TTL_MS = 60_000;
const UNREACHABLE_TTL_MS = 10_000;
const PROBE_TIMEOUT_MS = 1_000;

let probeCache: { ok: boolean; until: number } | null = null;
let probeInFlight: Promise<boolean> | null = null;

/** Host and port from `APP_DATABASE_URL`, or null if it is unparseable. */
function dbAddress(): { host: string; port: number } | null {
  const raw = process.env.APP_DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return { host: url.hostname, port: Number(url.port) || 5432 };
  } catch {
    return null;
  }
}

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    /* `once` on all three, and `destroy()` in the settle path: without it a
       refused probe leaves a socket in FIN_WAIT and the event loop holds open
       for the timeout duration. */
    const settle = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.once("connect", () => settle(true));
    socket.once("timeout", () => settle(false));
    socket.once("error", () => settle(false));
    socket.connect(port, host);
  });
}

/**
 * Is the database worth asking? Cached, and deduped across concurrent renders.
 *
 * A healthy answer is held for a minute, so the steady-state cost is one TCP
 * connect per minute per instance. A failure is held for only ten seconds, so
 * a database that comes back mid-session is picked up almost immediately
 * rather than staying "down" for a full minute.
 */
async function databaseReachable(): Promise<boolean> {
  const now = Date.now();
  if (probeCache && probeCache.until > now) return probeCache.ok;
  if (probeInFlight) return probeInFlight;

  const address = dbAddress();
  if (!address) {
    probeCache = { ok: false, until: now + UNREACHABLE_TTL_MS };
    return false;
  }

  probeInFlight = probe(address.host, address.port)
    .then((ok) => {
      probeCache = { ok, until: Date.now() + (ok ? REACHABLE_TTL_MS : UNREACHABLE_TTL_MS) };
      if (!ok) {
        console.warn(
          `[directory] ${address.host}:${address.port} is not accepting connections — ` +
            `public pages will render without therapist data for the next ` +
            `${UNREACHABLE_TTL_MS / 1000}s.`
        );
      }
      return ok;
    })
    .finally(() => {
      probeInFlight = null;
    });

  return probeInFlight;
}

/**
 * Flatten an error to a single string.
 *
 * ## Do not pass the error OBJECT to `console.error` here
 *
 * This looks like pointless ceremony and is not. A refused Postgres connection
 * rejects with an `AggregateError` carrying one `Error` per resolved address
 * (`::1` and `127.0.0.1`). Handing that object to `console.error` inside a
 * Next.js server render makes the dev server's error serialiser drop the
 * `errors` array and then reconstruct `new AggregateError(null)`, which throws
 * `TypeError: object null is not iterable`. That throw escapes as an
 * `uncaughtException`, stalls the render worker, and turns a caught, handled,
 * 8-millisecond connection refusal into `GET / 500 in 2.2min`.
 *
 * So the failure mode was not the database being down — that part was handled.
 * It was the logging of the database being down. Keep this returning a string.
 */
function describe(error: unknown): string {
  if (error instanceof AggregateError) {
    const causes = (error.errors ?? [])
      .map((e) => (e instanceof Error ? e.message : String(e)))
      .join("; ");
    return `AggregateError(${error.message || "no message"})${causes ? `: ${causes}` : ""}`;
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function safely<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
  /* The gate, before the driver is touched at all. See `databaseReachable`. */
  if (!(await databaseReachable())) return fallback;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${QUERY_TIMEOUT_MS}ms`)),
          QUERY_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    console.error(`[directory] ${what} failed; serving an empty directory. ${describe(error)}`);
    return fallback;
  } finally {
    /* Without this the timer keeps the event loop alive for three seconds
       after every successful query, which in dev shows up as a server that
       will not exit promptly on Ctrl-C. */
    if (timer) clearTimeout(timer);
  }
}

function toDirectory(row: {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  experience: number;
  specialties: string[] | null;
  timezone: string;
  sessionDurationMinutes: number;
}): DirectoryTherapist {
  return { ...row, specialties: row.specialties ?? [] };
}

/** Every publicly listed therapist, most experienced first. */
export async function listPublicTherapists(): Promise<DirectoryTherapist[]> {
  return safely(
    "listPublicTherapists",
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(publiclyVisible)
          .orderBy(desc(therapists.experience), therapists.name)
      );
      return rows.map(toDirectory);
    },
    []
  );
}

/**
 * A handful for the home page.
 *
 * Random rather than "top rated": `therapists.rating` is nullable and nothing
 * in the product writes to it yet, so ordering by it would silently order by
 * "whoever happens to have a value", which is not a ranking anybody agreed to.
 * Rotating the sample also means new clinicians get seen.
 */
export async function sampleTherapists(limit = 3): Promise<DirectoryTherapist[]> {
  return safely(
    "sampleTherapists",
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(publiclyVisible)
          .orderBy(sql`random()`)
          .limit(limit)
      );
      return rows.map(toDirectory);
    },
    []
  );
}

/** One therapist, or null. Applies the same visibility gate as the listing. */
export async function getPublicTherapist(id: string): Promise<DirectoryTherapist | null> {
  /* A malformed id would make Postgres raise on the uuid cast rather than
     return no rows, turning a 404 into a 500 for anyone who edits the URL. */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  return safely(
    `getPublicTherapist(${id})`,
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(and(publiclyVisible, eq(therapists.id, id)))
          .limit(1)
      );
      return rows[0] ? toDirectory(rows[0]) : null;
    },
    /* `null` here renders the 404, not a 500. A profile that cannot be read is
       indistinguishable from one that does not exist, from the visitor's side
       — and `notFound()` is the response that does not leak a stack trace. */
    null
  );
}

/** The specialty facets actually present in the directory, for the filter row. */
export function collectSpecialties(list: readonly DirectoryTherapist[]): string[] {
  const seen = new Set<string>();
  for (const t of list) for (const s of t.specialties) seen.add(s);
  return [...seen].sort((a, b) => a.localeCompare(b));
}
