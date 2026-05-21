import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { parseOrError, setRoleSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

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
    if (userId !== requester.$id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Cannot set role for another user." }, { status: 403 });
    }

    // SECURITY: only admins may grant the "therapist" label. Self-serve users
    // selecting "therapist" go through the KYC flow (/therapist/onboarding ->
    // /api/admin/therapist-kyc) and only get the label on admin approval.
    if (role === "therapist" && !isAdmin) {
      return NextResponse.json(
        { error: "Therapist role requires verification. Please complete KYC." },
        { status: 403 }
      );
    }

    const { users } = createAdminClient();
    const user = await users.get(userId);
    const existingLabels: string[] = user.labels ?? [];

    const hasExistingRole =
      existingLabels.includes("client") || existingLabels.includes("therapist");
    if (hasExistingRole && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: Role already set and you are not an admin." },
        { status: 403 }
      );
    }

    const filteredLabels = existingLabels.filter(
      (l) => l !== "client" && l !== "therapist"
    );
    await users.updateLabels(userId, [...filteredLabels, role]);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "user_role_selected",
      properties: { role, set_by_admin: isAdmin },
    });
    await posthog.shutdown();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to set role.";
    console.error("set-role error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
