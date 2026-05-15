import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { getPostHogClient } from "@/lib/posthog-server";

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user || !user.labels?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { therapistDocId, action } = (await req.json()) as { therapistDocId: string; action: "approve" | "reject" };

    if (!therapistDocId || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { databases, users } = createAdminClient();
    const kycStatus = action === "approve" ? "verified" : "rejected";

    const doc = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.therapists,
      therapistDocId,
      { kycStatus }
    );

    if (action === "approve") {
      // Also ensure the user has the 'therapist' label
      try {
        const userDoc = await users.get(doc.userId);
        const existingLabels = userDoc.labels ?? [];
        if (!existingLabels.includes("therapist")) {
          const filtered = existingLabels.filter(l => l !== "client");
          await users.updateLabels(doc.userId, [...filtered, "therapist"]);
        }
      } catch (labelError) {
        console.error("Failed to update user labels during approval:", labelError);
        // We still return ok: true because the document was updated
      }
    }

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: user.$id,
      event: "therapist_kyc_reviewed",
      properties: {
        therapist_doc_id: therapistDocId,
        therapist_user_id: doc.userId,
        action,
        kyc_status: kycStatus,
      },
    });
    await posthog.shutdown();

    return NextResponse.json({ ok: true, kycStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
