import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull, sql } from "drizzle-orm";

import { withSystem } from "@/lib/db/session";
import { payments, promoRedemptions } from "@/lib/db/schema";
import { verifyWebhookSignature, verifyTransaction, fromMinorUnits } from "@/lib/paystack";
import { updateUserMetadata, isManagementConfigured } from "@/lib/supabase/management";
import { capturePaymentEvent, SYSTEM_DISTINCT_ID } from "@/app/api/payments/analytics";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

/**
 * The promo code attached to this transaction, for analytics only.
 *
 * Read from the metadata we set at `/api/payments/initialize` and read back from
 * Paystack's verify API. It is NOT read from `promo_redemptions`: migration 0007
 * gives the webhook UPDATE but not SELECT on that table on purpose ("it cannot
 * read anything back"), and widening that policy to decorate an event would be a
 * poor trade.
 *
 * Metadata round-trips through the customer's browser, so it is treated exactly
 * as the initialize route treats it — a support convenience, never a source of
 * truth. Nothing is granted or priced from this value; it only labels an event.
 * Paystack can also hand metadata back as a JSON string rather than an object,
 * hence the defensive shape check.
 */
function promoCodeForAnalytics(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).promoCode;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Paystack webhook — the AUTHORITATIVE record of what was paid.
 *
 * The browser redirect after checkout is a convenience for the user; it is
 * user-controlled and proves nothing. This endpoint is what grants entitlements.
 *
 * Runs unauthenticated by necessity — Paystack has no session — so its entire
 * authorization is the HMAC signature check below. Nothing touches the database
 * before that passes.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // The RAW body, before any parsing. The signature is computed over these exact
  // bytes; a JSON round-trip can reorder keys or change whitespace and the HMAC
  // will never match.
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, req.headers.get("x-paystack-signature"))) {
    // Deliberately terse: an attacker probing the endpoint learns nothing about
    // why their forgery failed.
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const reference = event.data?.reference;
  if (!reference) {
    // 200, not 4xx: Paystack retries non-2xx responses, and an event we do not
    // care about would otherwise be redelivered indefinitely.
    return NextResponse.json({ ok: true, ignored: "no reference" });
  }

  // Only successful charges grant anything. Other events are acknowledged so
  // they stop being retried, but change nothing.
  if (event.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  try {
    /**
     * Re-verify against Paystack rather than trusting the payload.
     *
     * The signature proves the message came from Paystack, so this is belt and
     * braces — but it is cheap, and it means the amount and status we record are
     * read from the API rather than from a body that merely hashed correctly.
     */
    const verified = await verifyTransaction(reference);

    if (verified.status !== "success") {
      return NextResponse.json({ ok: true, ignored: `status=${verified.status}` });
    }

    /**
     * `withSystem`, NOT `withAnonymous` — this was a live bug, not a style
     * preference. Under `withAnonymous` `app_user_id()` is null, so
     * `payments_select` matched zero rows and the SELECT below never found the
     * payment it was settling: every charge took the "unknown reference" branch,
     * no entitlement was granted, and Paystack got a 200 so it never retried.
     * The customer was charged and received nothing, silently.
     *
     * The system context is authorised by the HMAC signature check above, which
     * has already passed by the time this runs. See migration 0010.
     */
    const outcome = await withSystem("paystack-webhook", async (tx) => {
      const [existing] = await tx
        .select({
          userId: payments.userId,
          plan: payments.plan,
          amountMinor: payments.amountMinor,
          currency: payments.currency,
          status: payments.status,
          /**
           * How many payments this person had ALREADY completed, as a correlated
           * subquery on the read that was happening anyway.
           *
           * Two reasons it rides along rather than being its own statement.
           * Round-trips to this database cost ~230ms each (see `lib/db/session.ts`),
           * and this is the one place where the count is trustworthy: it is
           * evaluated before the UPDATE below flips this row to `success`, so it
           * is strictly the count of PRIOR purchases. Asked afterwards — or from
           * a second transaction — it would race with its own write and quietly
           * report every purchase as a repeat.
           *
           * The outer column MUST stay written as `"payments".user_id`. Passing
           * `${payments.userId}` here is the obvious thing to write and it is
           * wrong: drizzle renders it unqualified as `"user_id"`, which binds to
           * the INNER `prior` row, making the predicate `prior.user_id =
           * prior.user_id` — always true, so the count silently becomes every
           * successful payment on the platform. The inner table is aliased
           * `prior` precisely so the bare name `payments` still refers outwards.
           */
          priorSuccesses: sql<number>`(
            SELECT count(*)::int FROM ${payments} prior
            WHERE prior.user_id = ${payments}.user_id AND prior.status = 'success'
          )`,
        })
        .from(payments)
        .where(eq(payments.reference, reference))
        .limit(1);

      if (!existing) {
        // A reference we never issued. Recorded rather than silently dropped —
        // it means either a bug or someone probing — but nothing is granted.
        console.error("paystack webhook: unknown reference", reference);
        return {
          granted: false as const,
          reason: "unknown reference",
          userId: null,
          plan: null,
        };
      }

      // IDEMPOTENCY. Paystack redelivers on any non-2xx, and can deliver the
      // same event more than once regardless. Without this, a retry would
      // re-grant the entitlement and pollute the ledger.
      if (existing.status === "success") {
        return {
          granted: false as const,
          reason: "already processed",
          userId: existing.userId,
          plan: existing.plan,
        };
      }

      /**
       * Guard against a mismatched amount.
       *
       * If what was actually paid differs from what we recorded when the
       * transaction was created, something is wrong — a tampered request, a
       * price change mid-checkout, a currency mix-up — and it must not silently
       * grant a plan. Recorded as failed for a human to look at.
       */
      if (verified.amount !== existing.amountMinor || verified.currency !== existing.currency) {
        await tx
          .update(payments)
          .set({
            status: "failed",
            paystackStatus: `amount/currency mismatch: charged ${verified.amount} ${verified.currency}, expected ${existing.amountMinor} ${existing.currency}`,
            raw: verified as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          })
          .where(eq(payments.reference, reference));

        console.error("paystack webhook: amount mismatch", { reference });
        return {
          granted: false as const,
          reason: "amount mismatch",
          userId: existing.userId,
          plan: existing.plan,
        };
      }

      await tx
        .update(payments)
        .set({
          status: "success",
          paystackStatus: verified.status,
          channel: verified.channel ?? null,
          paidAt: verified.paid_at ? new Date(verified.paid_at) : new Date(),
          raw: verified as unknown as Record<string, unknown>,
          updatedAt: new Date(),
        })
        .where(eq(payments.reference, reference));

      /**
       * Spend the promo NOW, not when it was validated.
       *
       * `/api/promo` writes a provisional row with a null payment reference so
       * the discount can be authorised at checkout; stamping the reference here
       * is what marks it actually consumed. An abandoned checkout therefore
       * leaves the code usable, which the previous burn-on-validate design did
       * not.
       *
       * Scoped to rows with no reference yet, so a redelivered webhook cannot
       * re-stamp a redemption already tied to a different payment.
       */
      await tx
        .update(promoRedemptions)
        .set({ paymentReference: reference, redeemedAt: new Date() })
        .where(
          and(
            eq(promoRedemptions.userId, existing.userId),
            isNull(promoRedemptions.paymentReference)
          )
        );

      return {
        granted: true as const,
        userId: existing.userId,
        plan: existing.plan,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        channel: verified.channel ?? null,
        // `+ 1` counts this purchase, which is not yet visible to the count above.
        purchaseIndex: Number(existing.priorSuccesses ?? 0) + 1,
      };
    });

    /**
     * Entitlement is granted AFTER the ledger row is committed, and outside the
     * transaction: Auth0 is a separate system with no shared rollback, and
     * holding a database transaction open across a third-party network call
     * would pin one of a small pool of connections.
     *
     * If this fails the payment still stands — which is the right way round. A
     * recorded payment with a missing entitlement is recoverable by replaying
     * the grant; a granted entitlement with no payment record is not.
     */
    if (outcome.granted && outcome.userId && outcome.plan) {
      if (!isManagementConfigured()) {
        console.error("paystack webhook: payment recorded but Auth0 Management API not configured", {
          reference,
        });
      } else {
        try {
          await updateUserMetadata(outcome.userId, { plan: outcome.plan });
        } catch (err) {
          console.error("paystack webhook: entitlement grant failed", { reference, err });
        }
      }
    }

    /**
     * Analytics. Outside the transaction — a network call inside it would pin one
     * of a pool of ~24 connections for the duration — and after the grant, so a
     * `payment_succeeded` describes a payment that is fully banked.
     *
     * Every capture below goes through `capturePaymentEvent`, which cannot throw.
     * That matters more here than anywhere else in the codebase: this block sits
     * inside the `try` whose `catch` returns 500, and a 500 asks Paystack to
     * redeliver an event whose entitlement has already been granted.
     */
    if (outcome.granted) {
      /**
       * ONLY on this branch. `already processed` deliberately fires nothing:
       * Paystack redelivers, and a `payment_succeeded` per delivery would report
       * revenue that was never earned. The idempotency check is what makes the
       * ledger trustworthy, and this keeps the analytics as trustworthy as the
       * ledger.
       */
      const amount = fromMinorUnits(outcome.amountMinor);

      await capturePaymentEvent({
        distinctId: outcome.userId,
        event: ANALYTICS_EVENTS.PAYMENT_SUCCEEDED,
        properties: {
          reference,
          plan: outcome.plan,
          amount_kes: amount,
          // A NUMBER, not a string. PostHog's revenue analytics silently ignores
          // a stringified amount, which is a very quiet way to report no revenue.
          revenue: amount,
          currency: outcome.currency,
          channel: outcome.channel,
          promo_code: promoCodeForAnalytics(verified.metadata),
          is_first_purchase: outcome.purchaseIndex === 1,
          purchase_index: outcome.purchaseIndex,
        },
      });
    } else if (outcome.reason !== "already processed") {
      /**
       * A charge that reached us and was refused: either an amount/currency
       * mismatch or a reference we never issued. Both are worth alerting on and
       * neither was visible before.
       *
       * An unknown reference has no user by definition, so it is attributed to a
       * system identity with person processing disabled — recording the event
       * without inventing a person for it.
       */
      await capturePaymentEvent({
        distinctId: outcome.userId ?? SYSTEM_DISTINCT_ID,
        event: ANALYTICS_EVENTS.PAYMENT_FAILED,
        properties: {
          reference,
          plan: outcome.plan,
          reason: outcome.reason,
          ...(outcome.userId ? {} : { $process_person_profile: false }),
        },
      });
    }

    // Response shape is unchanged: the fields added to `outcome` above are for
    // the events, and are not echoed back to Paystack.
    return NextResponse.json({
      ok: true,
      granted: outcome.granted,
      ...(outcome.granted
        ? { userId: outcome.userId, plan: outcome.plan }
        : { reason: outcome.reason }),
    });
  } catch (error: unknown) {
    console.error("paystack webhook error:", error);
    // 500 so Paystack retries — a transient failure here should not lose a
    // payment. The idempotency check above makes redelivery safe.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
