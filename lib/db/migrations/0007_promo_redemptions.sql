-- Separate promo DEFINITIONS from promo REDEMPTIONS.
--
-- `promos` was keyed on `code` with `used_by` / `used_at` NOT NULL on the same
-- row, which conflated the two and produced a promo system where:
--
--   • a code could be redeemed exactly ONCE, globally, by one person ever — the
--     `redemption_limit` column the admin UI reads could never be honoured,
--     because the primary key allowed a single row per code;
--   • redemption happened when the code was VALIDATED, so abandoning checkout
--     permanently burned it;
--   • nothing linked a redemption to the payment it discounted, so a discounted
--     charge could not be reconciled.
--
-- Definitions now live in `promos`; each use is a row in `promo_redemptions`,
-- unique per (code, user), carrying the payment reference it applied to.

CREATE TABLE promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(64) NOT NULL,
  -- Auth0 sub of the redeemer.
  user_id text NOT NULL,
  -- The charge this discount applied to. Null while checkout is in progress,
  -- set when the payment succeeds.
  payment_reference text,
  redeemed_at timestamptz NOT NULL DEFAULT now(),

  -- One redemption per person per code. This is the guarantee the old schema
  -- could not express: "used" was previously a property of the code itself.
  CONSTRAINT promo_redemptions_code_user_unique UNIQUE (code, user_id)
);

CREATE INDEX promo_redemptions_code_idx ON promo_redemptions (code);
CREATE INDEX promo_redemptions_user_id_idx ON promo_redemptions (user_id);

-- Carry existing single-use redemptions across before the columns go.
INSERT INTO promo_redemptions (code, user_id, redeemed_at)
SELECT code, used_by, used_at FROM promos WHERE used_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Policies must go FIRST: the existing ones reference `used_by`, and Postgres
-- refuses to drop a column any policy depends on. They are recreated below
-- against the new definition-table shape.
DROP POLICY IF EXISTS promos_select ON promos;
DROP POLICY IF EXISTS promos_insert ON promos;
DROP POLICY IF EXISTS promos_update ON promos;
DROP POLICY IF EXISTS promos_delete ON promos;

ALTER TABLE promos DROP COLUMN used_by;
ALTER TABLE promos DROP COLUMN used_at;

-- `promos` is now purely a definition table: a row means "this code exists".
-- Whether a given person may use it is answered by promo_redemptions.
ALTER TABLE promos ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON promo_redemptions TO echo_app;

ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions FORCE ROW LEVEL SECURITY;

CREATE POLICY promo_redemptions_select ON promo_redemptions FOR SELECT USING (
  user_id = app_user_id() OR app_is_admin()
);

-- You may only claim a code as yourself.
CREATE POLICY promo_redemptions_insert ON promo_redemptions FOR INSERT WITH CHECK (
  user_id = app_user_id() OR app_is_admin()
);

-- UPDATE is permissive for the same reason as `payments`: the webhook attaches
-- the payment reference and runs with no session, authorised instead by the
-- HMAC signature check. It cannot read anything back.
CREATE POLICY promo_redemptions_update ON promo_redemptions FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY promo_redemptions_delete ON promo_redemptions FOR DELETE USING (app_is_admin());

-- `promos`: readable by anyone signed in so a code can be validated at checkout;
-- writable only by admins. (The old policies were dropped above, before the
-- columns they depended on.)
CREATE POLICY promos_select ON promos FOR SELECT USING (true);
CREATE POLICY promos_insert ON promos FOR INSERT WITH CHECK (app_is_admin());
CREATE POLICY promos_update ON promos FOR UPDATE USING (app_is_admin());
CREATE POLICY promos_delete ON promos FOR DELETE USING (app_is_admin());
