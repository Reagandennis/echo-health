import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { payments } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { eq, and } from "drizzle-orm";
import { promoRedemptions, promos } from "@/lib/db/schema";
import {
  PLAN_PRICES,
  PLAN_CURRENCY,
  PROMO_DISCOUNT_PERCENT,
  applyPromoDiscount,
  assertPricesConfigured,
} from "@/lib/constants";
import {
  generateReference,
  initializeTransaction,
  isPaystackConfigured,
  toMinorUnits,
} from "@/lib/paystack";
import { capturePaymentEvent } from "@/app/api/payments/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * Start a Paystack transaction and return the hosted-checkout URL.
 *
 * THE AMOUNT IS NEVER TAKEN FROM THE CLIENT. The request carries a plan id; the
 * price is looked up here from `PLAN_PRICES`. Accepting an amount — or a price
 * that had been through the browser's currency conversion — is how a customer
 * pays one shilling for the top plan.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isPaystackConfigured()) {
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 501 }
      );
    }

    const limit = await rateLimit(`pay-init:${user.$id ?? clientIp(req)}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await req.json()) as { plan?: string; promoCode?: string };
    const plan = typeof body.plan === "string" ? body.plan.toLowerCase() : "";

    const listPrice = PLAN_PRICES[plan];
    if (listPrice === undefined) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }

    /**
     * Promo discounts are applied HERE, never client-side.
     *
     * The browser may claim to hold a code; it does not get to claim a price.
     * The code is re-checked against the configured value and against a
     * redemption recorded for THIS user, so a discount cannot be conjured by
     * editing the request.
     */
    let price = listPrice;
    let promoCode: string | null = null;
    let discountPercent = 0;

    const claimed =
      typeof body.promoCode === "string" ? body.promoCode.trim().toUpperCase() : "";

    if (claimed) {
      /**
       * Re-validated against the DATABASE, not against what the browser sent.
       *
       * The client may name a code; it does not get to name a discount. Both the
       * code's validity and its percentage are read here, so editing the request
       * cannot conjure a cheaper price.
       */
      const promo = await withUser(user, async (tx) => {
        const [definition] = await tx
          .select()
          .from(promos)
          .where(eq(promos.code, claimed))
          .limit(1);

        if (!definition || definition.disabled) return null;
        if (definition.expiresAt && definition.expiresAt.getTime() < Date.now()) return null;

        const [held] = await tx
          .select({ paymentReference: promoRedemptions.paymentReference })
          .from(promoRedemptions)
          .where(
            and(eq(promoRedemptions.code, claimed), eq(promoRedemptions.userId, user.$id))
          )
          .limit(1);

        // Must be held (claimed via /api/promo) and not already spent on a
        // completed charge.
        if (!held || held.paymentReference) return null;

        return definition;
      });

      if (!promo) {
        return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
      }

      discountPercent = promo.discount ?? PROMO_DISCOUNT_PERCENT;
      price = applyPromoDiscount(listPrice, discountPercent);
      promoCode = promo.code;
    }

    // The free plan must not reach a payment processor at all — Paystack rejects
    // zero-value transactions, and a "successful" zero charge would be a
    // confusing way to grant an entitlement.
    if (price <= 0) {
      return NextResponse.json(
        { error: "This plan does not require payment." },
        { status: 400 }
      );
    }

    // Refuses to charge while the placeholder prices are still in place.
    assertPricesConfigured();

    if (!user.email) {
      return NextResponse.json(
        { error: "An email address is required to pay." },
        { status: 400 }
      );
    }

    const reference = generateReference();
    const amountMinor = toMinorUnits(price);

    // Recorded BEFORE redirecting. If the user abandons checkout, or the webhook
    // arrives before the callback, there is already a row to reconcile against —
    // and the UNIQUE reference makes duplicate webhook delivery a no-op.
    await withUser(user, async (tx) => {
      await tx.insert(payments).values({
        reference,
        userId: user.$id,
        plan,
        amountMinor,
        currency: PLAN_CURRENCY,
        status: "pending",
      });
    });

    const origin = process.env.APP_BASE_URL ?? new URL(req.url).origin;

    const result = await initializeTransaction({
      email: user.email,
      amountMinor,
      currency: PLAN_CURRENCY,
      reference,
      callbackUrl: `${origin}/payment/callback`,
      // Echoed back on the webhook. Treated as a convenience for support, not as
      // a source of truth — metadata round-trips through the client's browser.
      metadata: { userId: user.$id, plan, promoCode },
    });

    /**
     * Top of the payment funnel. Fired only once Paystack has actually accepted
     * the transaction, so it counts intents that reached checkout rather than
     * requests that fell over on the way.
     *
     * `list_price_kes` and `amount_kes` are both recorded because the difference
     * between them IS the discount analysis — with only the charged amount, a
     * promo campaign is indistinguishable from a price cut.
     *
     * The distinct ID is the Auth0 sub. No email and no name: the properties
     * below are everything an analysis needs and nothing that identifies a
     * person to a third party.
     */
    await capturePaymentEvent({
      distinctId: user.$id,
      event: ANALYTICS_EVENTS.PAYMENT_INITIALIZED,
      properties: {
        reference,
        plan,
        list_price_kes: listPrice,
        amount_kes: price,
        discount_percent: discountPercent,
        promo_code: promoCode,
        currency: PLAN_CURRENCY,
      },
    });

    return NextResponse.json({
      authorizationUrl: result.authorization_url,
      reference: result.reference,
      // Returned so the UI can show exactly what will be charged, in the
      // currency it will actually be charged in.
      amount: price,
      listPrice,
      discountPercent,
      currency: PLAN_CURRENCY,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed to start.";
    console.error("payment initialize error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
