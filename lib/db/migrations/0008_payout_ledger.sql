-- Therapist payout ledger
--
-- Therapists are contractors paid `THERAPIST_REVENUE_SHARE` (40%) of session
-- revenue. Before this migration the platform had no record of that obligation
-- anywhere: `app/therapist/earnings/page.tsx` recomputed a total in the browser
-- on every render from `therapy_sessions.amount`, displayed it, and stored
-- nothing. Consequences, all of them live:
--
--   • Unpaid contractor liability existed only as a number a page happened to
--     calculate. It was on no balance sheet and in no table.
--   • Nothing recorded that a payout had been MADE, so nothing distinguished a
--     session that was paid from one that was not — there was no way to pay a
--     therapist without risking paying them twice, or never.
--   • Earnings were derived from a mutable column, so editing `amount` on an old
--     session silently restated what a clinician had already earned.
--
-- The fix is an accrual ledger: one immutable row per completed session, written
-- inside the transaction that completes it. Amounts become a fact recorded at a
-- point in time, not a derivation re-run at read time.
--
-- MINOR UNITS. Every money column here is in the currency's minor unit (KES
-- cents) as an integer, matching `payments.amount_minor`. Never a float — this
-- is money owed to a person, and rounding drift on a payroll ledger is not
-- recoverable after the fact.
--
-- Note the unit trap this table sits beside: `therapy_sessions.amount` is in
-- WHOLE KES (it predates the convention). The application multiplies by 100 on
-- the way in. `therapy_sessions.list_amount_minor`, added below, is already
-- minor — the `_minor` suffix is the only reliable way to tell them apart, so
-- keep it on anything new.

-- ─── Session pricing provenance ──────────────────────────────────────────────
--
-- Payouts are computed from the LIST price of a session, not the discounted
-- price the client paid (see `THERAPIST_PAID_ON_LIST_PRICE`). That requires
-- knowing, at accrual time, which purchase funded the session and what that plan
-- lists for — and neither was recoverable after the fact.
--
-- Sessions draw credits FIFO from the client's purchases, so "which bundle
-- funded session N" is only true at the instant of booking: cancelling an
-- earlier session renumbers the queue and changes the answer for every session
-- behind it. Re-deriving it later produces a different, wrong result. Both
-- values are therefore captured when the session is created.

ALTER TABLE therapy_sessions
  ADD COLUMN funding_payment_reference text,
  ADD COLUMN list_amount_minor integer;

COMMENT ON COLUMN therapy_sessions.funding_payment_reference IS
  'payments.reference of the charge whose credit this session consumed, captured at booking. Null for admin-comped sessions.';
COMMENT ON COLUMN therapy_sessions.list_amount_minor IS
  'Undiscounted per-session value in MINOR units, captured at booking so repricing PLAN_PRICES cannot restate historical payouts.';

-- ─── Ledger ──────────────────────────────────────────────────────────────────

-- `reversed` is a status, not a deleted row. A ledger you can delete from is not
-- a ledger; a mistaken accrual is cancelled in place and stays on the record.
CREATE TYPE payout_status AS ENUM ('accrued', 'paid', 'reversed');

-- What `gross_minor` was measured from. Recorded per row because it is a policy
-- choice that can change: flipping `THERAPIST_PAID_ON_LIST_PRICE` must not make
-- older rows unexplainable. 'unfunded' means no purchase backed the session
-- (admin-comped), which accrues zero — visibly, rather than silently.
CREATE TYPE payout_basis AS ENUM ('list', 'charged', 'unfunded');

CREATE TABLE payout_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE is the idempotency guarantee, and it is the whole safety story for
  -- double-accrual: re-completing an already-completed session, a retried
  -- request, or two concurrent transactions cannot produce a second row. The
  -- application inserts with ON CONFLICT DO NOTHING and relies on this
  -- constraint rather than on a prior read, which would race.
  session_id uuid NOT NULL,

  therapist_id uuid NOT NULL,

  -- Auth0 sub, denormalised from therapists.user_id. Two reasons, both real:
  -- the RLS policy becomes a column comparison instead of a subquery on every
  -- row, and re-pointing a therapists row at a different user cannot silently
  -- hand that person someone else's earnings history.
  therapist_user_id text NOT NULL,

  patient_id text NOT NULL,

  -- Copied from the session rather than joined at read time. A ledger line must
  -- keep meaning what it meant when written, even if the session is later
  -- edited, rescheduled, or repriced.
  session_scheduled_at timestamptz NOT NULL,

  plan text,
  -- The charge this session's credit came from, so a payout reconciles back to
  -- a specific Paystack transaction.
  funding_payment_reference text,

  -- Session value the share was taken on, per `basis`.
  gross_minor integer NOT NULL,
  -- What the client actually paid for this session. Equal to gross_minor only
  -- when nothing was discounted, which is what makes the cost of a promotion
  -- measurable instead of inferred.
  charged_minor integer NOT NULL,
  basis payout_basis NOT NULL,

  -- Revenue share in BASIS POINTS (4000 = 40%). An integer for the same reason
  -- the amounts are: the rate is part of the financial record, and 0.4 held as
  -- a float cannot be compared for equality or summed without drift.
  share_bp integer NOT NULL,

  -- Amount owed. Computed once, at accrual, and never recomputed — a later
  -- change to THERAPIST_REVENUE_SHARE must not restate what is already earned.
  amount_minor integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'KES',

  status payout_status NOT NULL DEFAULT 'accrued',
  -- Operator's payout run id, and the provider's transfer reference for it.
  payout_batch text,
  payout_reference text,
  paid_at timestamptz,

  reversed_at timestamptz,
  reversal_reason varchar(500),

  accrued_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT payout_ledger_session_id_unique UNIQUE (session_id),

  CONSTRAINT payout_ledger_session_id_therapy_sessions_id_fk
    FOREIGN KEY (session_id) REFERENCES therapy_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT payout_ledger_therapist_id_therapists_id_fk
    FOREIGN KEY (therapist_id) REFERENCES therapists(id) ON DELETE RESTRICT,

  CONSTRAINT payout_ledger_non_negative CHECK (
    gross_minor >= 0 AND charged_minor >= 0 AND amount_minor >= 0
  ),

  CONSTRAINT payout_ledger_share_range CHECK (share_bp > 0 AND share_bp <= 10000),

  -- A therapist cannot be owed more than the session was worth.
  CONSTRAINT payout_ledger_amount_within_gross CHECK (amount_minor <= gross_minor),

  -- The arithmetic is part of the record, so the database checks it rather than
  -- trusting the caller: the amount must actually be the stated share of the
  -- stated gross. The 1-unit tolerance absorbs any disagreement between
  -- Postgres' and JavaScript's rounding at an exact .5 boundary — wide enough
  -- that the constraint can never fire spuriously on some future share value,
  -- narrow enough that it still blocks an inflated payout.
  CONSTRAINT payout_ledger_amount_matches_share CHECK (
    abs(amount_minor - round(gross_minor::numeric * share_bp / 10000)) <= 1
  ),

  -- "Paid" without a batch reference is an untraceable payment, which defeats
  -- the point of the ledger. Recording the money and recording where it went
  -- are the same act.
  CONSTRAINT payout_ledger_paid_is_traceable CHECK (
    status <> 'paid' OR (payout_batch IS NOT NULL AND paid_at IS NOT NULL)
  ),

  CONSTRAINT payout_ledger_reversed_is_dated CHECK (
    status <> 'reversed' OR reversed_at IS NOT NULL
  )
);

-- The therapist's own earnings view: their rows, newest first.
CREATE INDEX payout_ledger_therapist_user_accrued_idx
  ON payout_ledger (therapist_user_id, accrued_at DESC);
-- "What is outstanding?" — where every payout run begins.
CREATE INDEX payout_ledger_status_idx ON payout_ledger (status);
CREATE INDEX payout_ledger_therapist_id_idx ON payout_ledger (therapist_id);
CREATE INDEX payout_ledger_payout_batch_idx ON payout_ledger (payout_batch);

-- No DELETE. Not granted here and not permitted by any policy below — the same
-- treatment `payments` gets, for the same reason: this is a financial record,
-- and corrections are new rows or status changes, never erasures.
GRANT SELECT, INSERT, UPDATE ON payout_ledger TO echo_app;

-- ─── Immutability ────────────────────────────────────────────────────────────
--
-- RLS controls WHO may write; this controls WHAT may change. Without it an admin
-- could edit `amount_minor` on a settled row and the ledger would silently
-- disagree with the money that actually moved. Only the payout fields are
-- mutable, and only forward: accrued → paid → reversed, never back.
--
-- search_path is pinned so a schema earlier in a caller's path cannot shadow the
-- functions this body resolves.

CREATE OR REPLACE FUNCTION payout_ledger_freeze() RETURNS trigger
  LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.id, NEW.session_id, NEW.therapist_id, NEW.therapist_user_id,
      NEW.patient_id, NEW.session_scheduled_at, NEW.plan,
      NEW.funding_payment_reference, NEW.gross_minor, NEW.charged_minor,
      NEW.basis, NEW.share_bp, NEW.amount_minor, NEW.currency, NEW.accrued_at)
     IS DISTINCT FROM
     (OLD.id, OLD.session_id, OLD.therapist_id, OLD.therapist_user_id,
      OLD.patient_id, OLD.session_scheduled_at, OLD.plan,
      OLD.funding_payment_reference, OLD.gross_minor, OLD.charged_minor,
      OLD.basis, OLD.share_bp, OLD.amount_minor, OLD.currency, OLD.accrued_at)
  THEN
    RAISE EXCEPTION
      'payout_ledger accruals are immutable; only status, payout_batch, payout_reference, paid_at, reversed_at and reversal_reason may change (row %)',
      OLD.id USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'reversed' AND NEW.status <> 'reversed' THEN
    RAISE EXCEPTION 'payout_ledger row % is reversed and cannot be reopened', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF OLD.status = 'paid' AND NEW.status = 'accrued' THEN
    RAISE EXCEPTION 'payout_ledger row % is already paid; reverse it rather than un-paying it', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER payout_ledger_freeze_trigger
  BEFORE UPDATE ON payout_ledger
  FOR EACH ROW EXECUTE FUNCTION payout_ledger_freeze();

-- ─── Row-level security ──────────────────────────────────────────────────────

ALTER TABLE payout_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_ledger FORCE ROW LEVEL SECURITY;

-- A therapist sees their own earnings and nobody else's; admins see everything.
-- Clients are deliberately excluded: what the platform pays a contractor is not
-- part of the client's transaction, even though it derives from their payment.
CREATE POLICY payout_ledger_select ON payout_ledger FOR SELECT USING (
  therapist_user_id = app_user_id() OR app_is_admin()
);

-- INSERT is bounded by the SESSION, not by the caller's identity, and that needs
-- justifying.
--
-- The accrual is written inside the transaction that marks a session complete,
-- and that transaction belongs to whoever ended the session — the therapist, the
-- client, or an admin. The writer is therefore frequently NOT the beneficiary,
-- so an ownership predicate like `therapist_user_id = app_user_id()` would fail
-- closed exactly when a client ends the call. Conversely a plain
-- `WITH CHECK (true)` (what `payments` uses) is not acceptable here: unlike a
-- payments row, a forged payout row CAN be read back by its forger, because it
-- is their own earnings.
--
-- So the policy constrains the row against the session it claims to be for:
--   • the session must exist, be completed, and belong to that therapist;
--   • the caller must be a participant on it, or an admin;
--   • the accrual cannot exceed what that session was actually worth.
--
-- Combined with UNIQUE(session_id) and the arithmetic CHECK above, the residual
-- exposure is that a therapist could overstate a session they genuinely
-- delivered, up to that session's own recorded value — bounded, attributable,
-- and visible to an admin before any batch is paid. The application computes the
-- figures; this is the floor under it, not the mechanism.
CREATE POLICY payout_ledger_insert ON payout_ledger FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM therapy_sessions ts
    WHERE ts.id = payout_ledger.session_id
      AND ts.therapist_id = payout_ledger.therapist_id
      AND ts.status = 'completed'
      AND (
        ts.patient_id = app_user_id()
        OR app_owns_therapist(ts.therapist_id)
        OR app_is_admin()
      )
      AND payout_ledger.gross_minor <= GREATEST(
        COALESCE(ts.list_amount_minor, 0),
        COALESCE(ts.amount, 0) * 100
      )
  )
);

-- Only admins move money. A therapist marking their own row 'paid' would be
-- self-certifying that they had been paid.
CREATE POLICY payout_ledger_update ON payout_ledger FOR UPDATE
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- No DELETE policy, deliberately. See the GRANT above.
