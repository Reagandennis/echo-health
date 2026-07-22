import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { PROMO_DISCOUNT_PERCENT } from "@/lib/constants";

import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { promoRedemptions, promos } from "@/lib/db/schema";
import { getPostHogClient } from "@/lib/posthog-server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { parseOrError, promoSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Validates a promo code against the `promos` table.
 *
 * The table is the source of truth — not a `PROMO_CODE` environment variable, as
 * this previously was. That mattered because `discount`, `redemption_limit`,
 * `expires_at` and `disabled` are real columns the admin UI already displays,
 * and while the env var gated everything those columns were decoration: an
 * admin could set a 20% discount or an expiry and nothing would honour it.
 *
 * This does NOT consume the code. A provisional row is claimed so the discount
 * can be authorised at checkout; the Paystack webhook stamps the payment
 * reference when the charge actually succeeds. Abandoning checkout therefore
 * leaves the code usable.
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

  const normalised = code.trim().toUpperCase();

  let result:
    | { ok: true; discount: number; freshClaim: boolean }
    | { ok: false; status: number; error: string };

  try {
    result = await withCurrentUser(async (tx) => {
      const [promo] = await tx
        .select()
        .from(promos)
        .where(eq(promos.code, normalised))
        .limit(1);

      // Unknown and disabled codes return the SAME message. Distinguishing them
      // would let someone enumerate which codes exist.
      if (!promo || promo.disabled) {
        return { ok: false as const, status: 400, error: "Invalid promo code." };
      }

      if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
        return { ok: false as const, status: 400, error: "This promo code has expired." };
      }

      const [mine] = await tx
        .select({ paymentReference: promoRedemptions.paymentReference })
        .from(promoRedemptions)
        .where(
          and(eq(promoRedemptions.code, normalised), eq(promoRedemptions.userId, userId))
        )
        .limit(1);

      // Spent on a completed payment — genuinely used up for this person.
      if (mine?.paymentReference) {
        return {
          ok: false as const,
          status: 409,
          error: "You have already used this promo code.",
        };
      }

      // Global cap. Only counts redemptions actually tied to a payment, so
      // provisional claims from abandoned checkouts do not exhaust a campaign.
      if (promo.redemptionLimit !== null && !mine) {
        const [used] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(promoRedemptions)
          .where(
            and(
              eq(promoRedemptions.code, normalised),
              isNotNull(promoRedemptions.paymentReference)
            )
          );

        if (used.count >= promo.redemptionLimit) {
          return {
            ok: false as const,
            status: 409,
            error: "This promo code has reached its redemption limit.",
          };
        }
      }

      if (!mine) {
        await tx
          .insert(promoRedemptions)
          .values({ code: normalised, userId })
          .onConflictDoNothing();
      }

      // Per-code discount, falling back to the platform default.
      // `freshClaim` distinguishes a first claim from a re-check of a hold the
      // user already had — see the capture below for why that matters.
      return {
        ok: true as const,
        discount: promo.discount ?? PROMO_DISCOUNT_PERCENT,
        freshClaim: !mine,
      };
    });
  } catch {
    return NextResponse.json(
      { error: "Could not validate promo code. Please try again." },
      { status: 500 }
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  /**
   * `promo_code_redeemed`, NOT `promo_code_applied`.
   *
   * Two names were in play: this route emitted `promo_code_applied` while every
   * event actually ingested — and `posthog-setup-report.md` — used
   * `promo_code_redeemed`. Two names for one action splits a funnel in half and
   * makes both halves look like a drop-off. The historical name wins so the
   * existing series stays continuous; there is no value in preserving both.
   *
   * `fresh_claim` separates first-time claims from re-validations. The checkout
   * page re-posts the held code on every visit, so counting rows here without it
   * would inflate redemptions by however many times someone reloaded checkout.
   *
   * `plan` is genuinely unavailable at this point — a code is validated before a
   * plan is chosen. Plan-level attribution comes from `promo_code` on
   * `payment_initialized` / `payment_succeeded`, joined on this user.
   *
   * Wrapped so it cannot throw: the provisional claim is already committed, and
   * a failed analytics call must not report a successful redemption as a 500 and
   * send the user off to re-enter a code they already hold.
   */
  try {
    const posthog = getPostHogClient();
    posthog.capture({
      // Auth0 sub, already checked to be the caller's own. No email, no name.
      distinctId: userId,
      event: ANALYTICS_EVENTS.PROMO_CODE_REDEEMED,
      properties: {
        code: normalised,
        discount_percent: result.discount,
        fresh_claim: result.freshClaim,
      },
    });
    await posthog.shutdown(3_000);
  } catch (err) {
    console.error("promo analytics capture failed", err);
  }

  return NextResponse.json({ success: true, discountPercent: result.discount });
}
