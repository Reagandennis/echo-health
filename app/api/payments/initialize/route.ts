import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { payments } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { eq, and } from "drizzle-orm";
import { promoRedemptions, promos } from "@/lib/db/schema";
import { PLAN_CURRENCY, PROMO_DISCOUNT_PERCENT } from "@/lib/constants";
import {
  amountToChargeKes,
  assertPricingConfigured,
  platformMarginKes,
  resolveMarket,
} from "@/lib/pricing";
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
 * THE AMOUNT IS NEVER TAKEN FROM THE CLIENT. The request carries a plan id and
 * at most a promo *code*; every shilling is computed here. Accepting an
 * amount — or a price that had been through the browser's currency
 * conversion — is how a customer pays one shilling for the top plan.
 *
 * ## Regional pricing does not weaken that, because the country is not the
 * ## client's to state either
 *
 * `resolveMarket(req)` reads a country header set by our own network edge and
 * nothing else: not the body, not the query string, not `Accept-Language`, and
 * not `lib/useCurrency.ts`, whose browser-side `ipapi.co` lookup is a display
 * courtesy and is trivially forged. The band it resolves to picks a lower KES
 * figure from `lib/pricing.ts`; `PLAN_PRICES` remains the ceiling. Read the
 * long comment at the top of that module before changing any of it — including
 * how far the header itself can be trusted, which depends on the deployment
 * and is therefore behind an explicit operator opt-in.
 *
 * A visitor who lies about their country gets, at worst, the standard published
 * price: the bands only ever reduce, and an untrusted or unreadable header
 * falls through to `standard`.
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

    /*
     * The country, from the request itself rather than from anything in `body`.
     * Deliberately resolved before the plan is even validated, so there is no
     * code path on which a later branch could take it from somewhere cheaper
     * to reach.
     */
    const market = resolveMarket(req);

    const baseline = amountToChargeKes({ plan, tier: market.tier });
    if (!baseline) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    const listPrice = baseline.listKes;

    /**
     * Promo discounts are applied HERE, never client-side.
     *
     * The browser may claim to hold a code; it does not get to claim a price.
     * The code is re-checked against the configured value and against a
     * redemption recorded for THIS user, so a discount cannot be conjured by
     * editing the request.
     */
    let price = baseline.chargeKes;
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
      /*
       * The band and the code do not stack — the client gets whichever is
       * better. `amountToChargeKes` holds that rule and the reasoning; the
       * short version is that 50% off an already-reduced tier charges less
       * than the therapist accrues for the session.
       */
      const withPromo = amountToChargeKes({
        plan,
        tier: market.tier,
        promoPercent: discountPercent,
      });
      /* Non-null: the same plan resolved a moment ago. Belt and braces rather
         than a `!`, because the fallback here would be a wrong CHARGE. */
      price = withPromo ? withPromo.chargeKes : baseline.chargeKes;
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

    /*
     * Refuses to charge while the placeholder prices are still in place, AND
     * while the regional band table disagrees with `PLAN_PRICES` — a band above
     * the published price, a plan a band forgot, or a country code that is not
     * a country. Both halves throw into the 500 handler below, which is the
     * right outcome: a purchase that fails is recoverable, a wrong charge is a
     * refund nobody notices.
     */
    assertPricingConfigured();

    /*
     * A charge that clears the platform less than it accrues to the clinician
     * is a deliberate, documented position at the discounted tiers — not a bug.
     * It is logged anyway, because the alternative is discovering the condition
     * from a quarterly review rather than from the line that caused it.
     */
    const margin = platformMarginKes(plan, price);
    if (margin?.platformClearsLess) {
      console.warn(
        `[payments] ${plan} at ${price} ${PLAN_CURRENCY} (tier=${market.tier}) clears ` +
          `${margin.platformKes} to the platform against ${margin.therapistKes} accrued ` +
          `to the therapist, per session. See THERAPIST_PAID_ON_LIST_PRICE.`
      );
    }

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
     * promo campaign is indistinguishable from a price cut. `tier_price_kes`
     * splits that difference in two once regional bands exist: without it, a
     * band and a promo are indistinguishable from each other.
     *
     * `price_tier` is a three-valued band label and `tier_source` names the
     * signal it came from — enough to reconcile revenue, and enough to see at a
     * glance if a deployment has stopped trusting its edge header and quietly
     * reverted everyone to the standard price.
     *
     * THE RESOLVED COUNTRY IS DELIBERATELY NOT SENT. A two-letter country
     * against a stable pseudonymous id, on a mental-health platform, is one
     * join away from "this individual, in this country, is in therapy" — and
     * the band label already carries everything a revenue question needs. Same
     * test as everywhere else in `lib/analytics`: would this be acceptable in a
     * breach notification?
     *
     * The distinct ID is the auth provider's subject id. No email and no name.
     */
    await capturePaymentEvent({
      distinctId: user.$id,
      event: ANALYTICS_EVENTS.PAYMENT_INITIALIZED,
      properties: {
        reference,
        plan,
        list_price_kes: listPrice,
        tier_price_kes: baseline.chargeKes,
        amount_kes: price,
        price_tier: market.tier,
        tier_source: market.source,
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
      // The band that applied, so a receipt or a support view can say why the
      // charge is below the published price. Informational: the browser has
      // already been redirected to Paystack for the amount above by the time
      // anything reads this, and nothing is priced from it.
      priceTier: market.tier,
      tierPrice: baseline.chargeKes,
      currency: PLAN_CURRENCY,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed to start.";
    console.error("payment initialize error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
