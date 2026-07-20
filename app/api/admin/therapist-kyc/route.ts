import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { kycDocuments, therapists } from "@/lib/db/schema";
import { getPostHogClient } from "@/lib/posthog-server";
import { parseOrError, kycReviewSchema } from "@/lib/validation";
import { assignRole, removeRole, isManagementConfigured } from "@/lib/auth0-management";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user || !user.labels?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = parseOrError(kycReviewSchema, await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { therapistDocId, action } = parsed.data;

    // `therapistDocId` is a `therapists.id` uuid. Screen it before querying —
    // Postgres raises `invalid input syntax for type uuid` on a malformed value,
    // which would surface as a 500 rather than a 400.
    if (!UUID_PATTERN.test(therapistDocId)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const kycStatus = action === "approve" ? "verified" : "rejected";

    const therapist = await withCurrentUser(async (tx) => {
      const [row] = await tx
        .update(therapists)
        .set({ kycStatus, updatedAt: new Date() })
        .where(eq(therapists.id, therapistDocId))
        .returning({ id: therapists.id, userId: therapists.userId });

      if (!row) return null;

      // Stamp the review trail on any of this therapist's documents that have
      // not been reviewed yet. Appwrite had no such trail at all — the license
      // was a bare public URL with no reviewer and no timestamp.
      await tx
        .update(kycDocuments)
        .set({ reviewedBy: user.$id, reviewedAt: new Date() })
        .where(
          and(
            eq(kycDocuments.therapistId, therapistDocId),
            isNull(kycDocuments.reviewedAt)
          )
        );

      return row;
    });

    if (!therapist) {
      return NextResponse.json({ error: "Therapist not found" }, { status: 404 });
    }

    /*
     * Second half of an approval: grant the "therapist" role in Auth0.
     *
     * Deliberately NOT inside the transaction above. Auth0 is a separate system
     * with no shared rollback — if the role call failed after a commit we could
     * not undo it, and holding a database transaction open across a network call
     * to a third party would pin a connection from a pool of ~24.
     *
     * A failure here is reported rather than thrown: the KYC decision is already
     * durably recorded and the queue has cleared, so the correct outcome is a
     * successful review with an explicit warning that the role still needs
     * granting — not a 500 that makes the admin repeat a completed review.
     */
    let roleAssigned = false;
    let roleError: string | undefined;

    if (action === "approve") {
      if (!isManagementConfigured()) {
        roleError =
          "Auth0 Management API credentials are not configured, so the " +
          "'therapist' role must be granted manually in the Auth0 dashboard.";
      } else {
        try {
          await assignRole(therapist.userId, "therapist");
          roleAssigned = true;
        } catch (err: unknown) {
          roleError = err instanceof Error ? err.message : "Failed to assign role";
          console.error("therapist-kyc role assignment failed:", err);
        }
      }
    } else {
      // Rejection revokes the role if the therapist previously held it, so a
      // later rejection actually removes access rather than only changing a label.
      if (isManagementConfigured()) {
        try {
          await removeRole(therapist.userId, "therapist");
        } catch (err: unknown) {
          console.error("therapist-kyc role revocation failed:", err);
        }
      }
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.$id,
      event: "therapist_kyc_reviewed",
      properties: {
        therapist_doc_id: therapistDocId,
        therapist_user_id: therapist.userId,
        action,
        kyc_status: kycStatus,
        role_assigned: roleAssigned,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({
      ok: true,
      kycStatus,
      roleAssigned,
      ...(roleAssigned
        ? {
            // The therapist's existing session still carries the old claim.
            notice:
              "Role granted. The therapist must sign out and back in before " +
              "gaining access — the roles claim is issued at login.",
          }
        : {}),
      ...(roleError ? { warning: `KYC ${kycStatus}, but: ${roleError}` } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
