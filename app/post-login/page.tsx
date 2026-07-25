import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";
import { PLAN_PRICES } from "@/lib/constants";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";

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

/**
 * Post-login landing page — the single place that routes a user by role.
 *
 * Under Appwrite the app owned the moment of login, so `signin/page.tsx` and the
 * OAuth callback (`app/api/oauth/route.ts`) each branched on `user.labels` right
 * after creating the session — two copies of the same rules that could drift.
 *
 * With Auth0 Universal Login the app never sees that moment: the browser leaves
 * for Auth0 and comes back through `/auth/callback`, which only knows the
 * `returnTo` it was handed. So `returnTo` points here, and this page performs the
 * branch once, on the server, from the freshly-minted session.
 *
 * A user with no role at all has not finished onboarding (they just signed up, or
 * they abandoned `/role-select` partway) and is sent to pick one.
 *
 * It is also the only place a `?plan=` can be carried across the Auth0 round
 * trip, so it forwards one when present. Someone who clicked "Couples" on the
 * pricing table has told us what they want; landing them on a generic dashboard
 * and making them find the plan again throws that away.
 */
export default async function AuthRedirectPage({
  searchParams,
}: {
  // Request-time API: a Promise in Next 16, not the plain object it was in 14.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getLoggedInUser(), searchParams]);

  // No session — the callback failed or the cookie was dropped. Back to the top.
  if (!user) {
    redirect("/signin");
  }

  const plan = planParam(params.plan);
  const planQuery = plan ? `?plan=${plan}` : "";

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
  const destination =
    role === "admin"
      ? "/admin"
      : role === "therapist"
        ? "/therapist"
        : role === "none"
          ? `/role-select${planQuery}`
          : plan
            ? `/onboarding${planQuery}`
            : "/dashboard";

  /*
   * THE ONLY PLACE A COMPLETED LOGIN IS OBSERVABLE.
   *
   * Universal Login means the browser leaves the app to authenticate, so the
   * client-side `sign_in_started` / `sign_up_started` events measure intent and
   * nothing else — they cannot distinguish a successful login from an abandoned
   * one. Until this event existed, the platform's single most important
   * conversion step was unmeasurable, and the saved funnels silently reported
   * zero. See `lib/analytics/events.ts`.
   *
   * `role: "none"` is the closest honest proxy for "new account": a user who
   * has authenticated but has never picked a role has just arrived.
   */
  await captureServer({
    distinctId: user.$id,
    event: ANALYTICS_EVENTS.USER_AUTHENTICATED,
    properties: { role, destination, has_plan_intent: Boolean(plan) },
    set: { role },
    setOnce: { signup_cohort: new Date().toISOString().slice(0, 7) },
  });

  redirect(destination);
}
