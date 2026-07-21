import { sql as raw } from "drizzle-orm";
import { db } from "./index";
import { getLoggedInUser, type SessionUser } from "@/lib/auth/session";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `fn` inside a transaction that carries the caller's identity, so the
 * Postgres RLS policies in migration 0001 can enforce row-level isolation.
 *
 * Why a transaction rather than a plain connection setting: `postgres.js` pools
 * and reuses connections across requests. A session-scoped `SET` would persist
 * on that connection and leak one user's identity into whichever request is
 * served next. `set_config(..., true)` is transaction-local and unwinds on
 * commit or rollback, which is the only safe option under pooling.
 *
 * Roles are passed as a comma-joined string because Postgres GUCs are text-only;
 * `app_has_role()` splits it back apart.
 */
export async function withUser<T>(
  user: SessionUser,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    /**
     * MUST be awaited before `fn(tx)` runs. Do not "optimise" this away.
     *
     * Issuing this without awaiting — to pipeline it with the first query and
     * save a round-trip — was tried and FAILS: the query lands before the GUC is
     * set, `app_user_id()` returns null, every RLS predicate fails closed, and
     * the caller silently receives zero rows. It fails safe rather than leaking,
     * but it fails.
     *
     * The extra round-trip is real (~230ms against this Azure instance) and is
     * the price of correctness here. To claw it back, reduce the latency (move
     * the database closer) rather than the ordering guarantee.
     */
    await tx.execute(
      raw`SELECT set_config('app.user_id', ${user.$id}, true),
                 set_config('app.user_roles', ${user.labels.join(",")}, true),
                 -- Explicitly NOT a system transaction. Transaction-local GUCs
                 -- already unwind on commit, so this is belt and braces — but it
                 -- makes "a user request can never hold system context" an
                 -- invariant of this function rather than a consequence of the
                 -- transaction-local flag three arguments away.
                 set_config('app.system_context', '', true)`
    );
    return fn(tx);
  });
}

/**
 * `withUser` for the common case of "whoever is logged in right now".
 * Throws when unauthenticated — callers that tolerate anonymous access should
 * use `withAnonymous` instead, so the distinction stays explicit at the call site.
 */
export async function withCurrentUser<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const user = await getLoggedInUser();
  if (!user) throw new Error("Unauthorized");
  return withUser(user, fn);
}

/**
 * Runs `fn` with NO identity set, so `app_user_id()` is null and every
 * ownership predicate fails closed. Use only for genuinely public reads (the
 * therapist directory) and the anonymous support-chat tables, whose policies
 * are intentionally permissive because they have no user column to bind to.
 */
export async function withAnonymous<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      raw`SELECT set_config('app.user_id', '', true),
                 set_config('app.user_roles', '', true),
                 set_config('app.system_context', '', true)`
    );
    return fn(tx);
  });
}

/**
 * Runs `fn` as the SYSTEM, for server-to-server callbacks that have no user
 * session and whose authenticity is established by a signature check.
 *
 * Sets `app.system_context`, which `app_is_system()` reads (migration 0010).
 * Policies that name it — currently `payments_select` and
 * `promo_redemptions_select` — admit the transaction; every other table is
 * untouched, so this is a narrow grant rather than an RLS bypass. It is NOT
 * equivalent to `BYPASSRLS`, and it deliberately carries no user identity:
 * `app_user_id()` stays null, so any ownership predicate still fails closed.
 *
 * WHY IT EXISTS. The Paystack webhook ran under `withAnonymous`, so
 * `app_user_id()` was null and `payments_select` matched zero rows. It could not
 * read the payment it was settling, concluded the reference was unknown, and
 * returned 200 without granting anything — so no payment could ever complete,
 * silently, while the customer had already been charged.
 *
 * ONLY FOR SIGNATURE-VERIFIED CALLBACKS. The caller must have already proven the
 * request came from the provider — for the webhook, the HMAC-SHA512 check over
 * the raw body, before any database work. Do NOT reach for this to make an RLS
 * error go away in a user-facing route: a route with a logged-in user wants
 * `withUser`/`withCurrentUser`, and one serving anonymous visitors wants
 * `withAnonymous`. Using it anywhere a request parameter can influence which
 * rows are touched turns these policies off for that request.
 *
 * `context` labels the caller (e.g. "paystack-webhook"). It is required so the
 * GUC is never set to an empty string — `app_is_system()` treats empty as unset,
 * so a blank label would silently produce a non-system transaction — and so the
 * value is meaningful when it shows up in `pg_stat_activity` during an incident.
 */
export async function withSystem<T>(
  context: string,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  if (!context.trim()) {
    throw new Error("withSystem requires a non-empty context label");
  }

  return db.transaction(async (tx) => {
    /**
     * MUST be awaited before `fn(tx)` runs, for exactly the reason documented on
     * `withUser` — pipelining this to save a round-trip lands the first query
     * before the GUC is set, `app_is_system()` returns false, and the caller
     * silently reads zero rows. Which is the precise failure this helper exists
     * to fix, so do not reintroduce it here.
     */
    await tx.execute(
      raw`SELECT set_config('app.user_id', '', true),
                 set_config('app.user_roles', '', true),
                 set_config('app.system_context', ${context}, true)`
    );
    return fn(tx);
  });
}
