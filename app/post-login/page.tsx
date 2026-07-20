import { redirect } from "next/navigation";
import { getLoggedInUser } from "@/lib/auth/session";

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
 */
export default async function AuthRedirectPage() {
  const user = await getLoggedInUser();

  // No session — the callback failed or the cookie was dropped. Back to the top.
  if (!user) {
    redirect("/signin");
  }

  if (user.labels.includes("admin")) {
    redirect("/admin");
  }

  if (user.labels.includes("therapist")) {
    redirect("/therapist");
  }

  if (!user.labels.includes("client")) {
    redirect("/role-select");
  }

  redirect("/dashboard");
}
