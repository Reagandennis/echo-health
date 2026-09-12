import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { parseOrError, setRoleSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  assignRole,
  getUserRoles,
  isManagementConfigured,
} from "@/lib/supabase/management";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";

/**
 * Assign a role to a user.
 *
 * Roles live in the Supabase user's `app_metadata.roles`, not in Postgres —
 * `getLoggedInUser()` reads them from the access-token claims — so this writes
 * through the service-role client in `lib/supabase/management.ts`. Storing them
 * in a local table instead would be worse than failing: the write would appear
 * to succeed while every `labels.includes(...)` check kept returning false.
 *
 * `app_metadata` rather than `user_metadata` is the load-bearing half. The
 * latter is writable by its owner from the browser, so a role there would be
 * self-grantable and this entire route — with its admin checks and its KYC gate
 * — would be decoration. See `lib/supabase/admin.ts`.
 *
 * THE CALLER MUST REFRESH THE SESSION AFTER A SUCCESS. See `requiresReauth` at
 * the bottom for what "refresh" means here; it is cheaper than it was under
 * Auth0, but it is not optional.
 */
export async function POST(req: NextRequest) {
  try {
    const requester = await getLoggedInUser();
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = await rateLimit(`set-role:${requester.$id ?? clientIp(req)}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = parseOrError(setRoleSchema, await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const { userId, role } = parsed.data;

    const isAdmin = requester.labels?.includes("admin") ?? false;

    // You may only set your own role, unless you are an admin.
    if (userId !== requester.$id && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Cannot set role for another user." },
        { status: 403 }
      );
    }

    // SECURITY: "therapist" grants access to clinical data, so it is never
    // self-serve. Applicants go through /onboarding/therapist → KYC review, and
    // /api/admin/therapist-kyc assigns the role on admin approval.
    if (role === "therapist" && !isAdmin) {
      return NextResponse.json(
        { error: "Therapist role requires verification. Please complete KYC." },
        { status: 403 }
      );
    }

    if (!isManagementConfigured()) {
      return NextResponse.json(
        {
          error:
            "Role assignment is unavailable: the Supabase service-role key is " +
            "not configured on this deployment. Ask an administrator to assign " +
            "your role.",
        },
        { status: 501 }
      );
    }

    // A non-admin may claim a role once but not switch afterwards, or a client
    // could reassign themselves at will. Admins may always change a role.
    const existing = await getUserRoles(userId);
    if (!isAdmin && existing.length > 0) {
      return NextResponse.json(
        { error: "Your role is already set. Contact support to change it." },
        { status: 403 }
      );
    }

    await assignRole(userId, role);

    /*
     * Attributed to the user whose role changed, not the requester — an admin
     * assigning a role on someone's behalf is still that person's activation
     * step, and attributing it to the admin would make the activation funnel
     * count staff instead of users.
     *
     * `captureServer` cannot throw, so a PostHog outage can never turn a
     * successful role assignment into a 500 the caller retries.
     */
    await captureServer({
      distinctId: userId,
      event: ANALYTICS_EVENTS.USER_ROLE_SELECTED,
      properties: { role, assigned_by_admin: isAdmin && userId !== requester.$id },
      set: { role },
    });

    return NextResponse.json({
      success: true,
      role,
      /**
       * The role exists now, but this browser's ACCESS TOKEN does not know it.
       *
       * Supabase stamps `app_metadata` into the JWT when the token is issued,
       * so the claim the app reads is a snapshot: `user.labels` stays empty,
       * every `labels.includes(...)` guard keeps returning false, and a client
       * who just chose "client" is bounced straight back to `/role-select`.
       *
       * What actually picks the new role up is a TOKEN REFRESH, which happens
       * on any of:
       *   - `supabase.auth.refreshSession()` from the browser — the deliberate
       *     one, and what a caller acting on this flag should do;
       *   - the automatic refresh when the access token expires (one hour by
       *     default) or when `proxy.ts` refreshes an expiring session;
       *   - a fresh sign-in.
       *
       * That is strictly cheaper than the Auth0 flow this replaced, which
       * required a full round trip through `/auth/login` to mint a new ID
       * token. The flag is still returned explicitly rather than left implicit,
       * because a caller that forgets it strands someone in a roleless session
       * that looks exactly like a failed assignment.
       */
      requiresReauth: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to set role.";
    console.error("set-role error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
