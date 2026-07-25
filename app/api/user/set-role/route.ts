import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { parseOrError, setRoleSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import {
  assignRole,
  getUserRoles,
  isManagementConfigured,
} from "@/lib/auth0-management";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { captureServer } from "@/lib/analytics/server";

/**
 * Assign a role to a user.
 *
 * Roles live in Auth0, not Postgres — `getLoggedInUser()` reads them from a token
 * claim — so this writes through the Management API. Storing them in a local
 * table instead would be worse than failing: the write would appear to succeed
 * while every `labels.includes(...)` check kept returning false.
 *
 * The caller MUST send the user back through `/auth/login` after a success. The
 * roles claim is minted at login and then cached in the session cookie, so a
 * freshly assigned role is invisible to the current session. Auth0's SSO session
 * makes that redirect silent — no credential re-entry.
 */
export async function POST(req: NextRequest) {
  try {
    const requester = await getLoggedInUser();
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`set-role:${requester.$id ?? clientIp(req)}`, {
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
            "Role assignment is unavailable: Auth0 Management API credentials " +
            "are not configured. Ask an administrator to assign your role.",
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
       * Tells the caller the user must re-authenticate before the role takes
       * effect. Returned explicitly rather than left implicit, so a caller that
       * forgets cannot silently strand someone in a roleless session.
       */
      requiresReauth: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to set role.";
    console.error("set-role error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
