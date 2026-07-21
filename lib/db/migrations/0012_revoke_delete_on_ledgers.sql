-- Revoke DELETE on the financial ledgers.
--
-- `payments` and `promo_redemptions` were written with no DELETE *policy*, on
-- the reasoning that a financial ledger must not be erasable through the
-- application. That reasoning was right; the mechanism was incomplete.
--
-- A default ACL applied when `echo_app` was provisioned (`echo_app=arwd`) grants
-- DELETE on every table `echo_admin` creates, and it is invisible in the
-- migration history. So the app role has always held the DELETE privilege on
-- both tables.
--
-- Data was never actually at risk: with RLS enabled and no DELETE policy, a
-- delete matches zero rows. But it SUCCEEDS — reporting "0 rows deleted" rather
-- than a permission error — so a bug that tried to remove a payment would look
-- like it had worked, and would be found later, in reconciliation, rather than
-- immediately.
--
-- Revoking the grant makes the intent enforced at two levels instead of one, and
-- turns a silent no-op into a loud failure. `payout_ledger` already did this
-- (migration 0009); this brings the older ledgers in line.

REVOKE DELETE ON payments FROM echo_app;
REVOKE DELETE ON promo_redemptions FROM echo_app;
