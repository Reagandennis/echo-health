import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { getPostHogClient } from "@/lib/posthog-server";

const VALID_ROLES = ["client", "therapist"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function POST(req: NextRequest) {
  try {
    const requester = await getLoggedInUser();
    const { userId, role } = (await req.json()) as { userId: string; role: Role };

    if (!userId || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Verify requester has permission to set THIS userId's role
    const isAdmin = requester?.labels?.includes("admin");
    if (userId !== requester?.$id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Cannot set role for another user." }, { status: 403 });
    }

    const { users } = createAdminClient();

    // Verify user exists
    const user = await users.get(userId);
    const existingLabels: string[] = user.labels ?? [];

    // Only allow setting a role if:
    // 1. The user has no role labels yet (onboarding)
    // 2. OR the requester is an admin
    const hasExistingRole = existingLabels.includes("client") || existingLabels.includes("therapist");

    if (hasExistingRole && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized: Role already set and you are not an admin." }, { status: 403 });
    }

    // Preserving any existing labels (e.g. "admin") and add the new role
    // Filter out old roles if we are re-assigning via admin
    const filteredLabels = existingLabels.filter(l => l !== "client" && l !== "therapist");
    await users.updateLabels(userId, [...filteredLabels, role]);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "user_role_selected",
      properties: { role, set_by_admin: isAdmin ?? false },
    });
    await posthog.shutdown();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to set role.";
    console.error("set-role error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
