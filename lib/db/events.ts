import postgres from "postgres";

/**
 * Realtime change feed — the replacement for Appwrite's realtime subscriptions.
 *
 * ONE Postgres LISTEN connection per Node process, fanning out to many browser
 * clients in memory. This is not an optimisation: the Azure tier permits ~24
 * application connections in total, so a connection-per-subscriber design would
 * exhaust the server at ~24 concurrent users and start refusing logins.
 *
 * Payloads carry identifiers only (see migration 0002). Subscribers receive a
 * "something you care about changed" signal and refetch through the normal
 * RLS-protected queries — so this path cannot leak rows a user may not read,
 * even if the audience computation were wrong.
 *
 * Requires a long-lived process (Azure App Service / Container Apps). On
 * serverless platforms the listener is torn down between invocations and
 * notifications are silently lost.
 */

export interface ChangeEvent {
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  audience: string[];
}

type Subscriber = (event: ChangeEvent) => void;

/**
 * Keyed by audience token — an Auth0 `sub` for user-scoped tables, or an opaque
 * chat session id for the anonymous support chat.
 */
const subscribers = new Map<string, Set<Subscriber>>();

const globalForEvents = globalThis as unknown as {
  __echoListener?: ReturnType<typeof postgres>;
  __echoListenerReady?: Promise<void>;
};

function dispatch(event: ChangeEvent) {
  const seen = new Set<Subscriber>();
  for (const token of event.audience) {
    const set = subscribers.get(token);
    if (!set) continue;
    for (const fn of set) {
      // A subscriber can appear under several tokens (e.g. both ends of a
      // conversation); deliver at most once per event.
      if (seen.has(fn)) continue;
      seen.add(fn);
      try {
        fn(event);
      } catch {
        // A failing subscriber must not stall delivery to the others.
      }
    }
  }
}

/**
 * Opens the shared LISTEN connection once per process. Idempotent and safe to
 * call on every request; the promise is cached across hot reloads in dev.
 */
function ensureListening(): Promise<void> {
  if (globalForEvents.__echoListenerReady) {
    return globalForEvents.__echoListenerReady;
  }

  const connectionString = process.env.APP_DATABASE_URL;
  if (!connectionString) {
    throw new Error("APP_DATABASE_URL is not set");
  }

  // Dedicated single connection: a LISTEN must stay bound to one backend, so it
  // cannot share the request pool. Note this is also why Azure's built-in
  // PgBouncer must not sit in front of it — transaction pooling multiplexes
  // backends and notifications would be delivered to the wrong one, or dropped.
  const listener = postgres(connectionString, { ssl: "require", max: 1 });
  globalForEvents.__echoListener = listener;

  globalForEvents.__echoListenerReady = listener
    .listen("echo_changes", (payload) => {
      try {
        dispatch(JSON.parse(payload) as ChangeEvent);
      } catch {
        // Malformed payload — drop it rather than killing the listener.
      }
    })
    .then(() => undefined);

  return globalForEvents.__echoListenerReady;
}

/**
 * Subscribe to changes addressed to any of `tokens`.
 * Returns an unsubscribe function; callers MUST invoke it on disconnect or the
 * subscriber map grows without bound.
 */
export async function subscribe(
  tokens: string[],
  onEvent: Subscriber
): Promise<() => void> {
  await ensureListening();

  for (const token of tokens) {
    let set = subscribers.get(token);
    if (!set) {
      set = new Set();
      subscribers.set(token, set);
    }
    set.add(onEvent);
  }

  return () => {
    for (const token of tokens) {
      const set = subscribers.get(token);
      if (!set) continue;
      set.delete(onEvent);
      if (set.size === 0) subscribers.delete(token);
    }
  };
}

/** Diagnostics: how many tokens and subscribers this process is holding. */
export function subscriberStats() {
  let total = 0;
  for (const set of subscribers.values()) total += set.size;
  return { tokens: subscribers.size, subscribers: total };
}
