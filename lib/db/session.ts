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
    await tx.execute(
      raw`SELECT set_config('app.user_id', ${user.$id}, true),
                 set_config('app.user_roles', ${user.labels.join(",")}, true)`
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
                 set_config('app.user_roles', '', true)`
    );
    return fn(tx);
  });
}
