/**
 * Echo Health — Auth0 post-login Action: surface roles as a namespaced claim.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS FILE IS NOT IMPORTED BY THE APP. It must be installed in the Auth0
 * dashboard manually (the MCP connection lacks the `create:actions` scope):
 *
 *   1. Auth0 Dashboard → Actions → Library → Build Custom
 *   2. Name: "Add roles to ID token"
 *      Trigger: Login / Post Login
 *      Runtime: Node 18+
 *   3. Paste the code below, click Deploy.
 *   4. Actions → Triggers → post-login → drag the action into the flow → Apply.
 *   5. Assign roles under User Management → Roles ("admin", "therapist", "client"),
 *      then attach them to users. Requires RBAC; alternatively set
 *      `app_metadata.roles = ["admin"]` on the user directly — this Action reads both.
 *
 * Verify: log in, hit /auth/profile, and confirm the
 * "https://echo-health.app/roles" claim is present.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THE NAMESPACE: Auth0 silently drops custom claims that are not
 * namespaced with a URL prefix. A bare "roles" claim will not appear in the token.
 *
 * WHY IT MATTERS: `lib/auth/session.ts` reads this claim and exposes it as
 * `user.labels`, which preserves the Appwrite-era role guards
 * (`user.labels?.includes("admin")`) across ~76 existing call sites. If this
 * Action is not deployed, every role check silently evaluates to false and
 * admins/therapists are locked out of their sections.
 */
exports.onExecutePostLogin = async (event, api) => {
  const ROLES_CLAIM = "https://echo-health.app/roles";
  const METADATA_CLAIM = "https://echo-health.app/user_metadata";

  const fromAuthz = (event.authorization && event.authorization.roles) || [];
  const fromMetadata = (event.user.app_metadata && event.user.app_metadata.roles) || [];

  // Union, de-duplicated, strings only.
  const roles = Array.from(
    new Set([...fromAuthz, ...fromMetadata].filter((r) => typeof r === "string"))
  );

  api.idToken.setCustomClaim(ROLES_CLAIM, roles);
  api.accessToken.setCustomClaim(ROLES_CLAIM, roles);

  // user_metadata is the analogue of Appwrite's user "prefs" object
  // (plan, sessionType, commStyle, emergency contact). Surfaced as `user.prefs`.
  api.idToken.setCustomClaim(METADATA_CLAIM, event.user.user_metadata || {});
};
