/**
 * Block until Postgres and Redis are accepting connections.
 *
 * `docker compose up -d` returns as soon as the containers are *started*,
 * which is several seconds before Postgres is *ready* — the first init run has
 * to create the cluster, run `docker-entrypoint-initdb.d`, then restart. So
 * `npm run db:up && npm run db:apply` fails on a cold volume roughly every
 * time, with an ECONNREFUSED that looks like a configuration error rather than
 * a race. This sits between them.
 *
 * A raw TCP probe rather than a driver connection, for the same reason
 * `lib/directory.ts` uses one: a refused Postgres connection rejects with an
 * `AggregateError`, and printing that object inside Node's error handling is
 * how a handled failure elsewhere in this repo turned into a two-minute hang.
 * A socket either connects or it does not.
 *
 * Redis is probed too but is NOT required — it is optional everywhere in the
 * app, so a missing one is reported and shrugged at.
 */

import net from "node:net";

const TIMEOUT_MS = 60_000;
const INTERVAL_MS = 500;

function probe(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1_000);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

async function waitFor(label, host, port, required) {
  const deadline = Date.now() + TIMEOUT_MS;
  process.stdout.write(`Waiting for ${label} on ${host}:${port} `);
  while (Date.now() < deadline) {
    if (await probe(host, port)) {
      console.log("— ready.");
      return true;
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.log(required ? "— TIMED OUT." : "— not running (optional, continuing).");
  return false;
}

const pg = await waitFor("Postgres", "127.0.0.1", 5432, true);
if (!pg) {
  console.error(
    "\nPostgres did not come up within 60s. Check:\n\n" +
      "  docker compose ps\n  docker compose logs postgres\n"
  );
  process.exit(1);
}

/* Port-open is necessary but not sufficient: on a cold volume Postgres binds,
   runs the init scripts, then restarts, so there is a window where the socket
   accepts and the database does not. Compose's healthcheck runs `pg_isready`
   against the real database, so defer to it rather than reimplementing it. */
const { execFileSync } = await import("node:child_process");
const deadline = Date.now() + 60_000;
process.stdout.write("Waiting for the container healthcheck ");
for (;;) {
  let status = "unknown";
  try {
    status = execFileSync(
      "docker",
      ["inspect", "--format", "{{.State.Health.Status}}", "echo-postgres"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    /* Container not found, or docker unavailable. The TCP probe already
       succeeded, so proceed rather than block on a check we cannot run. */
    console.log("— unavailable, proceeding on the TCP probe.");
    break;
  }
  if (status === "healthy") {
    console.log("— healthy.");
    break;
  }
  if (Date.now() > deadline) {
    console.log(`— still "${status}" after 60s, proceeding anyway.`);
    break;
  }
  process.stdout.write(".");
  await new Promise((r) => setTimeout(r, INTERVAL_MS));
}

await waitFor("Redis", "127.0.0.1", 6379, false);
