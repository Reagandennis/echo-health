/**
 * Deploys the Echo Health Auth0 Actions and orders the post-login flow.
 *
 *   npx tsx scripts/auth0-deploy-actions.ts
 *
 * Idempotent: creates an Action if missing, updates it otherwise, deploys the
 * new version, and rewrites the post-login binding order.
 *
 * ORDER IS SIGNIFICANT. Account linking must run BEFORE the roles Action:
 * `setPrimaryUser` re-points the login at the primary identity, and the roles
 * Action should be reading the primary user's claim, not the duplicate's.
 *
 * Requires AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET with
 * `create:actions`, `update:actions`, `read:actions`, `update:triggers`.
 */

import { readFileSync } from "node:fs";

function env(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.trimStart().startsWith("#")) {
        out[line.slice(0, i).trim()] ||= line.slice(i + 1).trim();
      }
    }
  } catch {
    /* process.env only */
  }
  return out;
}

const E = env();
const DOMAIN = E.AUTH0_DOMAIN;

/**
 * The post-login flow, in execution order.
 *
 * `auth` already exists in the tenant and holds the roles/metadata claim logic;
 * it is left untouched here and simply re-ordered after the linker.
 */
const ACTIONS = [
  {
    name: "account-linking",
    file: "scripts/auth0-account-linking-action.js",
    // Secrets are per-Action; the linker needs Management API access of its own
    // because Actions cannot reach the app's environment.
    secrets: [
      { name: "AUTH0_DOMAIN", value: DOMAIN },
      { name: "M2M_CLIENT_ID", value: E.AUTH0_M2M_CLIENT_ID },
      { name: "M2M_CLIENT_SECRET", value: E.AUTH0_M2M_CLIENT_SECRET },
    ],
  },
  {
    // Roles + user_metadata claims. Managed here so the tenant matches the repo
    // rather than whatever was last pasted into the dashboard.
    name: "auth",
    file: "scripts/auth0-roles-action.js",
    secrets: [],
  },
];

/** Final binding order for the post-login trigger. */
const FLOW_ORDER = ["account-linking", "auth"];

async function token(): Promise<string> {
  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: E.AUTH0_M2M_CLIENT_ID,
      client_secret: E.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function api<T = unknown>(
  path: string,
  method: string,
  bearer: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`https://${DOMAIN}/api/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

interface Action {
  id: string;
  name: string;
  all_changes_deployed?: boolean;
}

async function main() {
  if (!DOMAIN || !E.AUTH0_M2M_CLIENT_ID || !E.AUTH0_M2M_CLIENT_SECRET) {
    throw new Error("AUTH0_DOMAIN / AUTH0_M2M_CLIENT_ID / AUTH0_M2M_CLIENT_SECRET required");
  }

  const bearer = await token();
  const existing = (await api<{ actions: Action[] }>("/actions/actions", "GET", bearer)).actions;

  for (const spec of ACTIONS) {
    const code = readFileSync(spec.file, "utf8");
    const found = existing.find((a) => a.name === spec.name);

    const payload = {
      name: spec.name,
      code,
      runtime: "node22",
      supported_triggers: [{ id: "post-login", version: "v3" }],
      secrets: spec.secrets,
    };

    let id: string;
    if (found) {
      await api(`/actions/actions/${found.id}`, "PATCH", bearer, {
        code,
        secrets: spec.secrets,
      });
      id = found.id;
      console.log(`✓ updated  ${spec.name}`);
    } else {
      const created = await api<Action>("/actions/actions", "POST", bearer, payload);
      id = created.id;
      console.log(`✓ created  ${spec.name}`);
    }

    await api(`/actions/actions/${id}/deploy`, "POST", bearer);
    console.log(`✓ deployed ${spec.name}`);
  }

  // ── Rebind the flow in the required order ─────────────────────────────────
  const all = (await api<{ actions: Action[] }>("/actions/actions", "GET", bearer)).actions;
  const bindings = FLOW_ORDER.flatMap((name) => {
    const a = all.find((x) => x.name === name);
    if (!a) {
      console.log(`! skipping "${name}" — not found in tenant`);
      return [];
    }
    return [{ ref: { type: "action_id", value: a.id }, display_name: a.name }];
  });

  await api("/actions/triggers/post-login/bindings", "PATCH", bearer, { bindings });
  console.log(`\n✓ post-login flow: ${bindings.map((b) => b.display_name).join(" → ")}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
