-- Record WHICH PLAN funded a session, alongside the reference and list price
-- captured in migration 0008.
--
-- Those two columns make a payout traceable and correctly priced, but they do
-- not make it self-explaining: a ledger row showing `gross_minor = 650000` gives
-- no answer to "why that number?" without joining back to `payments`.
--
-- And a therapist cannot make that join. `payments_select` admits the payer,
-- admins and the system context — not the clinician who delivered the session.
-- That is the correct policy (a therapist has no business reading a client's
-- billing history) but it means the plan name is unavailable at exactly the
-- moment the accrual is written, since the accrual runs in the transaction of
-- whoever completed the session.
--
-- So the plan is captured at booking, in the same breath as the other two
-- provenance values, and copied onto the ledger row. `payout_ledger` rows then
-- explain themselves without a join, and without widening who may read
-- `payments`.

ALTER TABLE therapy_sessions ADD COLUMN funding_plan text;

COMMENT ON COLUMN therapy_sessions.funding_plan IS
  'Plan key (individual/plus/couples) of the bundle whose credit this session consumed, captured at booking. Null for admin-comped sessions.';
