import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { promos } from "@/lib/db/schema";
import { getPostHogClient } from "@/lib/posthog-server";
import { parseOrError, promoSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Redeems the single active promo code.
 *
 * The Appwrite version had to bootstrap its own collection on every request
 * (`ensureCollection`) because the promo table was never in the setup script.
 * `promos` is a real migrated table now, so that is gone.
 *
 * Single-redemption is still enforced by the primary key: `promos.code` IS the
 * code, so a second redemption hits a PK conflict. `onConflictDoNothing()`
 * turns that into an empty `returning()`, which is the "already used" signal —
 * atomic, and not subject to a check-then-insert race.
 */
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

  const normalised = PROMO_CODE.toUpperCase();

  let redeemed: boolean;
  try {
    redeemed = await withCurrentUser(async (tx) => {
      const rows = await tx
        .insert(promos)
        .values({ code: normalised, usedBy: userId, usedAt: new Date() })
        .onConflictDoNothing({ target: promos.code })
        .returning({ code: promos.code });

      return rows.length > 0;
    });
  } catch {
    return NextResponse.json(
      { error: "Could not redeem promo code. Please try again." },
      { status: 500 }
    );
  }

  if (!redeemed) {
    return NextResponse.json(
      { error: "This promo code has already been used." },
      { status: 409 }
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
