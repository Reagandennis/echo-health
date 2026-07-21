-- System context: let the Paystack webhook read the rows it is settling.
--
-- THE BUG THIS FIXES — no payment could ever complete.
--
-- `app/api/payments/webhook/route.ts` runs under `withAnonymous()`, which sets
-- `app.user_id` to the empty string, so `app_user_id()` returns NULL. The
-- policy from migration 0006 was:
--
--   payments_select USING (user_id = app_user_id() OR app_is_admin())
--
-- `user_id = NULL` evaluates to NULL, never true, so the webhook's opening
-- SELECT matched ZERO rows for every reference — including references it had
-- just issued. Reproduced against the live database before this migration:
--
--   -- as echo_app, no identity set (exactly what the webhook does):
--   SELECT count(*) FROM payments WHERE reference = 'test_wh_repro';  -->  0
--
-- The route reads that empty result as "a reference we never issued", logs it,
-- takes the ungranted branch and returns 200. The consequences all land on the
-- customer: Paystack has taken their money, the payment row stays `pending`
-- forever, no entitlement is written to Auth0, and no plan is granted. Paystack
-- sees a 200 and never retries. It is silent at every layer — no exception, no
-- 500, no failed-payment event — and it fails closed in the one direction that
-- costs a real person real money.
--
-- WHY NOT THE OBVIOUS FIX. `payments_select USING (true)` would work and is
-- wrong: `payments` is read by ordinary authenticated users through
-- `listMyPaymentsAction`, so a blanket-true SELECT hands every signed-in user
-- the entire platform's payment history — amounts, plans, and the Auth0 sub of
-- every payer. Fixing a webhook by publishing the billing table is not a fix.
--
-- WHAT THIS DOES INSTEAD. Adds a third, explicit identity alongside "a user"
-- and "nobody": a system context, carried in its own transaction-local GUC and
-- set only by `withSystem()` in lib/db/session.ts. It is deliberately
-- greppable — `app_is_system` in SQL, `withSystem` in TypeScript — so the set of
-- code paths that hold it can be enumerated by search, which is the property
-- that keeps it auditable as the codebase grows.
--
-- WHAT AUTHORIZES IT. Not a session — Paystack has none. The webhook's entire
-- authorization is the HMAC-SHA512 signature check over the raw request body,
-- performed before any database work happens; if it fails the request is
-- rejected 401 and nothing here is ever reached. This GUC does not grant that
-- trust, it only carries it into the transaction.
--
-- THE RULE THAT KEEPS THIS SAFE: `withSystem()` must never be reachable from a
-- user-facing route. It is for server-to-server callbacks whose authenticity is
-- established by signature verification. A route that has a logged-in user
-- wants `withUser`/`withCurrentUser`; one serving anonymous visitors wants
-- `withAnonymous`. Reaching for `withSystem` to make an RLS error go away
-- disables row isolation on these tables for that request.

CREATE OR REPLACE FUNCTION app_is_system() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.system_context', true), '') IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION app_is_system() TO echo_app;

-- ─── payments ────────────────────────────────────────────────────────────────
-- Postgres has no "alter policy predicate", so the policy is replaced whole.
-- The user-facing terms are unchanged: this only adds the system term.

DROP POLICY IF EXISTS payments_select ON payments;

CREATE POLICY payments_select ON payments FOR SELECT USING (
  user_id = app_user_id()
  OR app_is_admin()
  -- The settlement path. Authorised by the webhook's HMAC signature check, not
  -- by a session — see the header. Without this the webhook cannot read the row
  -- it is about to settle, and no payment can ever complete.
  OR app_is_system()
);

-- ─── promo_redemptions ───────────────────────────────────────────────────────
-- Migration 0007 gave the webhook UPDATE but not SELECT, on the reasoning that
-- it "cannot read anything back". That holds for a forged insert, but it also
-- means the settlement path cannot verify which redemption it just stamped, or
-- reconcile a discounted charge against the code that produced it. Granted
-- under the same signature-verified system context, and to nobody else.

DROP POLICY IF EXISTS promo_redemptions_select ON promo_redemptions;

CREATE POLICY promo_redemptions_select ON promo_redemptions FOR SELECT USING (
  user_id = app_user_id()
  OR app_is_admin()
  OR app_is_system()
);
