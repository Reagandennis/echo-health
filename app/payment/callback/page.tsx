import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getLoggedInUser } from "@/lib/auth/session";
import { withUser } from "@/lib/db/session";
import { payments } from "@/lib/db/schema";
import { verifyTransaction } from "@/lib/paystack";

/**
 * Where Paystack returns the user after checkout.
 *
 * This page exists for the USER's benefit — so they see a confirmation without
 * waiting for webhook delivery. It is not what grants the plan: the webhook is,
 * because a browser redirect is user-controlled and can be forged by typing a
 * URL. Everything below re-verifies with Paystack and reads the ledger; nothing
 * is trusted from the query string.
 *
 * The two paths can also race — the webhook often lands first. That is fine:
 * both are idempotent, and this one only ever reports state, never changes
 * entitlements.
 */
export const dynamic = "force-dynamic";

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const user = await getLoggedInUser();
  if (!user) redirect("/signin");

  const params = await searchParams;
  // Paystack sends both; they are the same value.
  const reference = params.reference ?? params.trxref;

  if (!reference) {
    redirect("/payment/failed?reason=missing-reference");
  }

  let paid = false;
  let plan: string | null = null;

  try {
    const verified = await verifyTransaction(reference);
    paid = verified.status === "success";

    // Read the plan from OUR ledger, keyed on the reference — not from the
    // Paystack metadata, which round-tripped through the user's browser.
    const row = await withUser(user, async (tx) => {
      const [found] = await tx
        .select({ plan: payments.plan, userId: payments.userId })
        .from(payments)
        .where(eq(payments.reference, reference))
        .limit(1);
      return found;
    });

    // RLS already restricts this select to the caller's own rows, so a missing
    // row here means either an unknown reference or someone else's — both of
    // which are "not yours" and are treated identically.
    if (!row) {
      redirect("/payment/failed?reason=not-found");
    }

    plan = row.plan;
  } catch (error) {
    console.error("payment callback verification failed:", error);
    redirect("/payment/failed?reason=verification-failed");
  }

  if (!paid) {
    redirect("/payment/failed?reason=declined");
  }

  redirect(`/payment/success?plan=${encodeURIComponent(plan ?? "")}`);
}
