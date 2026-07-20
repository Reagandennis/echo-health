/**
 * Echo Health — Auth0 post-login Action: link accounts that share a verified email.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Auth0 treats every connection as a separate user. Someone who signs up with a
 * password in January and clicks "Continue with Google" in March ends up with
 * two users and two different `sub` values.
 *
 * That is not cosmetic here. Every row in the database is keyed on the `sub`:
 * `profiles.user_id`, `therapy_sessions.patient_id`, `journal_entries.user_id`,
 * and the RLS policies that gate them. A duplicate identity therefore means:
 *
 *   • an empty second account with no therapy history,
 *   • RLS correctly refusing to show the person their own records,
 *   • their clinician opening a blank chart,
 *   • and any role they were granted silently not applying.
 *
 * For a mental-health record, splitting someone's history in half without
 * telling anyone is a serious failure, so this Action merges the identities
 * before the application ever sees them.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * SECURITY: linking is performed ONLY between accounts whose email Auth0 has
 * verified — on both sides. Linking on an unverified address would let an
 * attacker sign up through a provider that skips verification, claim someone
 * else's email, and inherit their account and clinical data. That check is the
 * entire security boundary of this Action; do not relax it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEPLOYMENT (handled by scripts/auth0-deploy-actions.ts)
 *
 * Trigger: post-login. Must be ordered BEFORE the "auth" roles Action.
 * Secrets required: AUTH0_DOMAIN, M2M_CLIENT_ID, M2M_CLIENT_SECRET
 * Scopes required: read:users, update:users
 *
 * One-time caveat: on the very first login where a link happens, the roles
 * claim may still reflect the pre-link identity, because Auth0 computes
 * `event.authorization` before Actions run. The next sign-in is correct. This
 * affects each user at most once, which is why it is accepted rather than
 * worked around with a second Management API round-trip on every login.
 * ─────────────────────────────────────────────────────────────────────────────
 */
exports.onExecutePostLogin = async (event, api) => {
  const email = event.user.email;

  // No email, or an unverified one, means there is nothing safe to match on.
  if (!email || !event.user.email_verified) {
    return;
  }

  const domain = event.secrets.AUTH0_DOMAIN;
  const clientId = event.secrets.M2M_CLIENT_ID;
  const clientSecret = event.secrets.M2M_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    console.log("account-linking: secrets missing, skipping");
    return;
  }

  try {
    // ── Management API token ────────────────────────────────────────────────
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (!tokenRes.ok) {
      console.log("account-linking: token request failed", tokenRes.status);
      return;
    }

    const { access_token: token } = await tokenRes.json();
    const authHeader = { Authorization: `Bearer ${token}` };

    // ── Find every account sharing this email ───────────────────────────────
    const usersRes = await fetch(
      `https://${domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { headers: authHeader }
    );

    if (!usersRes.ok) {
      console.log("account-linking: user lookup failed", usersRes.status);
      return;
    }

    const users = await usersRes.json();

    // Only verified accounts are eligible, in either direction.
    const eligible = users.filter((u) => u.email_verified);

    if (eligible.length < 2) {
      return; // Nothing to link.
    }

    // ── Choose the primary ──────────────────────────────────────────────────
    // The OLDEST account wins. It is the one that accumulated the profile,
    // sessions and clinical history, and its `sub` is what the database rows
    // already reference. Linking into a newer account would orphan all of it.
    eligible.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const primary = eligible[0];

    if (primary.user_id === event.user.user_id) {
      // Already signing in as the primary; nothing further is needed. The
      // secondary will be absorbed when it is next used to log in.
      return;
    }

    // ── Link the current (secondary) identity into the primary ──────────────
    const [provider, ...rest] = event.user.user_id.split("|");
    const secondaryId = rest.join("|");

    const linkRes = await fetch(
      `https://${domain}/api/v2/users/${encodeURIComponent(primary.user_id)}/identities`,
      {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, user_id: secondaryId }),
      }
    );

    if (!linkRes.ok) {
      const detail = await linkRes.text();
      console.log("account-linking: link failed", linkRes.status, detail);
      return;
    }

    // Continue this login as the primary user, so the application receives the
    // `sub` its data is already keyed on.
    api.authentication.setPrimaryUser(primary.user_id);

    console.log(
      `account-linking: linked ${event.user.user_id} into ${primary.user_id}`
    );
  } catch (err) {
    // Never block a login on this. A failure here means the user signs in with
    // an unlinked account — recoverable and visible — whereas throwing would
    // lock them out entirely.
    console.log("account-linking: unexpected error", err && err.message);
  }
};
