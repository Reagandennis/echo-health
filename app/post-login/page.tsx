import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";
import { PLAN_PRICES } from "@/lib/constants";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";
import { scrubUrl } from "@/lib/analytics/sanitize";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * The plan a visitor picked on the landing page, if it survived the trip.
 *
 * Validated against the real plan ids rather than forwarded blind: this value
 * ends up in a redirect target, and "free" is excluded because it is not
 * something anyone can choose to buy.
 */
function planParam(value: string | string[] | undefined): string | null {
  const plan = Array.isArray(value) ? value[0] : value;
  if (!plan || plan === "free" || !(plan in PLAN_PRICES)) return null;
  return plan;
}

function firstValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

/**
 * Post-login landing page — the single place that routes a user by role.
 *
 * Under Appwrite the app owned the moment of login, so `signin/page.tsx` and the
 * OAuth callback each branched on `user.labels` right after creating the session
 * — two copies of the same rules that could drift. Auth0 Universal Login took
 * that moment away entirely, and this page was where the branch moved to.
 *
 * With Supabase the app sees a password sign-in again, and the branch stays
 * here anyway, for reasons that outlived Auth0:
 *
 *  - it is server-side, so the roles it reads come from the session rather than
 *    from anything the browser could have edited;
 *  - OAuth and email-confirmation links come back through `/auth/callback`,
 *    which knows only the `next` it was handed and has no business knowing the
 *    role rules;
 *  - it is the ONLY place a completed login is observable (see below), so
 *    routing everything through it is what makes the funnel measurable.
 *
 * A user with no role at all has not finished onboarding (they just signed up,
 * or they abandoned `/role-select` partway) and is sent to pick one.
 *
 * It also carries the two things a visitor told us before authenticating:
 * `?plan=` from the pricing table, and `?next=` — the page they were trying to
 * reach when the proxy bounced them to sign in.
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getLoggedInUser(), searchParams]);

  const plan = planParam(params.plan);
  const planQuery = plan ? `?plan=${plan}` : "";

  /*
   * The deep link the visitor originally asked for, reduced to a safe
   * same-origin path. This is attacker-supplied — it arrives on a URL that can
   * be emailed — so it goes through the same guard as `/auth/callback`; see
   * `lib/auth/safe-redirect.ts` for why an open redirect here is account
   * takeover rather than a nuisance. `""` means "nothing usable".
   */
  const next = safeRedirectPath(firstValue(params.next), "");

  /*
   * No session. Either the callback failed, the cookie was dropped, or Supabase
   * is unconfigured on this deployment — `getLoggedInUser()` cannot tell those
   * apart and neither can we, so the honest move is to send them back to the
   * form, which says which variables are missing when that is the reason.
   *
   * The plan and destination are handed back so a failed attempt does not also
   * cost the visitor the choice they had already made.
   */
  if (!user) {
    const retry = new URLSearchParams();
    if (plan) retry.set("plan", plan);
    if (next) retry.set("next", next);
    const query = retry.toString();
    redirect(query ? `/signin?${query}` : "/signin");
  }

  /*
   * The destination is computed BEFORE anything redirects, because `redirect()`
   * works by throwing: a capture placed after one never runs, and a capture
   * placed before each one would be five copies of the same call.
   */
  const role = user.labels.includes("admin")
    ? "admin"
    : user.labels.includes("therapist")
      ? "therapist"
      : user.labels.includes("client")
        ? "client"
        : "none";

  // Staff are not buying anything; a stray `?plan=` is ignored for them.
  // An existing client who arrived by clicking a plan wants that plan, not the
  // dashboard. /onboarding rather than /checkout so the choice is still shown
  // and confirmable before any money is involved.
  const roleDestination =
    role === "admin"
      ? "/admin"
      : role === "therapist"
        ? "/therapist"
        : plan
          ? `/onboarding${planQuery}`
          : "/dashboard";

  /*
   * A `next` wins over the role's default landing page — it is where the person
   * was actually going — with one exception: somebody with NO role has to pick
   * one first. Sending them on to `/dashboard` or `/therapist` would land them
   * in a portal whose layout expects a role, and `/role-select` is a staging
   * post they pass through in seconds anyway.
   */
  const destination =
    role === "none" ? `/role-select${planQuery}` : next || roleDestination;

  /*
   * THE ONLY PLACE A COMPLETED LOGIN IS OBSERVABLE.
   *
   * The client-side `sign_in_started` / `sign_up_started` events fire on a
   * click and measure intent: they cannot tell a completed login from an
   * abandoned one, an unconfirmed sign-up, or a password that was wrong five
   * times. Until this event existed, the platform's single most important
   * conversion step was unmeasurable and the saved funnels silently reported
   * zero. See `lib/analytics/events.ts`.
   *
   * `role: "none"` is the closest honest proxy for "new account": a user who
   * has authenticated but has never picked a role has just arrived.
   *
   * Pseudonymous by design — the Supabase user id and a coarse role, never the
   * email or name. `distinctId` is `user.$id`, which is now the Supabase `sub`
   * rather than the Auth0 one; both are opaque ids, so nothing about this
   * event's shape changes.
   */
  /*
   * `destination` is SCRUBBED, and this is new.
   *
   * It used to be one of five hard-coded literals. Now that a `?next=` can
   * carry a deep link, it can be `/dashboard/sessions/<uuid>` or
   * `/therapist/clients/<clientId>` — a record id, in an analytics property,
   * against a stable person id. That is exactly the leak `sanitize.ts` was
   * written for, and `captureServer` does NOT run the client-side
   * `sanitize_properties` hook, so nothing else would catch it.
   */
  await captureServer({
    distinctId: user.$id,
    event: ANALYTICS_EVENTS.USER_AUTHENTICATED,
    properties: {
      role,
      destination: scrubUrl(destination),
      has_plan_intent: Boolean(plan),
    },
    set: { role },
    setOnce: { signup_cohort: new Date().toISOString().slice(0, 7) },
  });

  redirect(destination);
}
