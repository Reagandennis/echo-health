import { NextRequest, NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { getPostHogClient } from "@/lib/posthog-server";
import { parseOrError, promoSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "";
const COLLECTION_ID = "promos";

/**
 * Ensures the `promos` collection exists. Safe to call on every request —
 * it's a no-op if the collection already exists.
 */
async function ensureCollection(
  databases: ReturnType<typeof createAdminClient>["databases"]
) {
  try {
    await databases.getCollection(DATABASE_ID, COLLECTION_ID);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 404) {
      await databases.createCollection(
        DATABASE_ID,
        COLLECTION_ID,
        "Promo Codes",
        [] // no special permissions — admin-only access via API key
      );
      await databases.createStringAttribute(
        DATABASE_ID,
        COLLECTION_ID,
        "usedBy",
        255,
        true
      );
      await databases.createDatetimeAttribute(
        DATABASE_ID,
        COLLECTION_ID,
        "usedAt",
        true
      );
    }
  }
}

export async function POST(req: NextRequest) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`promo:${user.$id ?? clientIp(req)}`, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = parseOrError(promoSchema, await req.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const { code, userId } = parsed.data;

  if (userId !== user.$id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const PROMO_CODE = process.env.PROMO_CODE;

  if (!PROMO_CODE) {
    return NextResponse.json(
      { error: "No promo codes are active." },
      { status: 400 }
    );
  }

  if (code.trim().toUpperCase() !== PROMO_CODE.toUpperCase()) {
    return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
  }

  const { databases } = createAdminClient();

  try {
    await ensureCollection(databases);
  } catch {
    return NextResponse.json(
      { error: "Could not validate promo code. Please try again." },
      { status: 500 }
    );
  }

  // Document ID = normalised code. If it already exists, the code was used.
  const docId = PROMO_CODE.toUpperCase();

  try {
    await databases.getDocument(DATABASE_ID, COLLECTION_ID, docId);
    // Document exists → already redeemed
    return NextResponse.json(
      { error: "This promo code has already been used." },
      { status: 409 }
    );
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 404) {
      // Not yet redeemed — proceed
    } else {
      return NextResponse.json(
        { error: "Could not validate promo code. Please try again." },
        { status: 500 }
      );
    }
  }

  // Mark the code as used (atomic — second request will get a 409 from Appwrite)
  try {
    await databases.createDocument(DATABASE_ID, COLLECTION_ID, docId, {
      usedBy: userId,
      usedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) {
      return NextResponse.json(
        { error: "This promo code has already been used." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not redeem promo code. Please try again." },
      { status: 500 }
    );
  }

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "promo_code_redeemed",
    properties: { code: code.trim().toUpperCase() },
  });
  await posthog.shutdown();

  return NextResponse.json({ success: true });
}
