-- Paystack payments.
--
-- Every charge gets a durable row BEFORE the user is sent to Paystack, and that
-- row is the idempotency key for everything that follows. Paystack retries
-- webhooks on non-2xx and can deliver the same event more than once, so
-- "already recorded as successful" must be cheap and safe to detect.
--
-- Amounts are stored in the currency's MINOR unit (KES cents) as an integer.
-- Never use a float for money: 0.1 + 0.2 is not 0.3 in binary floating point,
-- and rounding drift on a payment ledger is not recoverable after the fact.
-- Paystack's API also speaks in minor units, so this avoids a conversion at the
-- boundary where a mistake means charging 100× or 1/100×.

CREATE TYPE payment_status AS ENUM ('pending', 'success', 'failed', 'abandoned');

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Paystack's transaction reference. UNIQUE is the idempotency guarantee:
  -- a duplicate webhook cannot create a second row or grant a second entitlement.
  reference text NOT NULL UNIQUE,

  -- Auth0 sub of the payer. Text, not uuid — see the schema conventions.
  user_id text NOT NULL,

  plan text NOT NULL,
  -- Minor units (KES cents). 8_900_00 = KES 8,900.
  amount_minor integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'KES',

  status payment_status NOT NULL DEFAULT 'pending',
  -- Paystack's own status string, kept verbatim for support and reconciliation.
  paystack_status text,
  -- Channel actually used (card, mobile_money, bank_transfer …).
  channel text,

  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Full verified payload. A payment ledger without the provider's own record of
  -- the event is very hard to reconcile when a customer disputes a charge.
  raw jsonb
);

CREATE INDEX payments_user_id_created_at_idx ON payments (user_id, created_at DESC);
CREATE INDEX payments_status_idx ON payments (status);

GRANT SELECT, INSERT, UPDATE ON payments TO echo_app;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

-- READS are restricted: a payment history is sensitive.
CREATE POLICY payments_select ON payments FOR SELECT USING (
  user_id = app_user_id() OR app_is_admin()
);

-- WRITES are deliberately permissive, and this needs justifying.
--
-- The webhook is called by Paystack, not by a signed-in user, so there is no
-- session and `app_user_id()` is null — an ownership predicate would fail closed
-- and the webhook could never record anything. Its authorization is the
-- HMAC-SHA512 signature check in `app/api/payments/webhook/route.ts`, verified
-- against PAYSTACK_SECRET_KEY before any database work happens.
--
-- Note this is write-only exposure: a forged insert cannot read anything back,
-- and entitlements are granted from the verified Paystack payload rather than
-- from whatever a row happens to contain.
CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (true);
CREATE POLICY payments_update ON payments FOR UPDATE USING (true) WITH CHECK (true);

-- No DELETE policy at all: payment records are a financial ledger and must not
-- be removable through the application. Corrections are new rows, not edits.
