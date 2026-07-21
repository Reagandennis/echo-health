-- Stop a therapist writing their own KYC verdict
--
-- THE HOLE. `therapists_update` (migration 0001) is
-- `USING ((user_id = app_user_id()) OR app_is_admin())` with the same
-- WITH CHECK. It authorises the ROW, not the COLUMNS — so the owner of a
-- therapists row may write every column on it, including `kyc_status`. Verified
-- against the live database: a transaction carrying only `roles=therapist` ran
--
--     UPDATE therapists SET kyc_status = 'verified' WHERE id = <own row>
--
-- and it succeeded. `therapists_insert` has the same shape, so a new row could
-- also be created already `verified`.
--
-- This was not reachable through the application: `upsertTherapistProfileAction`
-- passes its input through a `pick()` whitelist that omits `kycStatus`. That is
-- exactly why it survived — the only thing standing between a therapist and
-- self-certification was one whitelist in one function, and nothing failed if a
-- future action forgot it. On a platform whose entire credentialing story is
-- "an admin reviewed this clinician", that is the wrong place for the guarantee
-- to live.
--
-- WHY A TRIGGER, not column privileges. `REVOKE UPDATE (kyc_status) ON
-- therapists FROM echo_app` is the textbook fix and does not work here: the
-- application connects as `echo_app` for EVERY user, and distinguishes admins
-- from therapists through the `app.user_roles` GUC that RLS reads. A column
-- revoke would block admins too, since Postgres sees one role. The distinction
-- only exists at the level `app_is_admin()` operates on, so the check has to
-- happen there.
--
-- WHAT IS STILL ALLOWED. `submitKycForReviewAction` runs as the THERAPIST and
-- legitimately moves the application into review. That single transition stays
-- permitted; everything else about the verdict is admin-only.

CREATE OR REPLACE FUNCTION therapists_guard_kyc_columns() RETURNS trigger AS $$
BEGIN
  -- Admins review applications; that is the whole job. Nothing below applies.
  IF app_is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-created therapist row starts unverified, always. Without this an
    -- applicant could insert themselves already approved and never appear in a
    -- queue at all.
    IF NEW.kyc_status <> 'incomplete' THEN
      RAISE EXCEPTION
        'kyc_status must be ''incomplete'' on a self-created therapist row (got %)', NEW.kyc_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.kyc_reviewed_at IS NOT NULL
       OR NEW.kyc_reviewed_by IS NOT NULL
       OR NEW.kyc_review_note IS NOT NULL THEN
      RAISE EXCEPTION 'review fields are set by reviewers, not by applicants'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- The one transition an applicant may make for themselves: submitting.
  -- `canSubmitForReview()` in lib/kyc.ts encodes the same rule application-side;
  -- this is the copy that holds when a caller forgets.
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    IF NOT (OLD.kyc_status IN ('incomplete', 'rejected') AND NEW.kyc_status = 'pending') THEN
      RAISE EXCEPTION
        'a therapist may only move their own application from incomplete/rejected to pending (attempted % -> %)',
        OLD.kyc_status, NEW.kyc_status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- WHO reviewed and WHEN are never the applicant's to write. These are the
  -- provenance of the decision; a rejected therapist who could blank them would
  -- erase the fact that a review took place at all.
  IF NEW.kyc_reviewed_at IS DISTINCT FROM OLD.kyc_reviewed_at
     OR NEW.kyc_reviewed_by IS DISTINCT FROM OLD.kyc_reviewed_by THEN
    RAISE EXCEPTION 'kyc_reviewed_at/kyc_reviewed_by may only be written by an admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The note is narrower: an applicant may CLEAR it, and only as part of
  -- resubmitting. `submitKycForReviewAction` does exactly this, so that a stale
  -- "your licence had expired" is not left sitting beside a fresh submission the
  -- reviewer has not looked at yet.
  --
  -- Clearing is safe; the note's permanent copy lives in `kyc_review_events`,
  -- which nobody can update or delete. Writing an arbitrary value is NOT safe —
  -- that would let an applicant author text attributed to a reviewer — so this
  -- permits the transition to NULL and nothing else.
  IF NEW.kyc_review_note IS DISTINCT FROM OLD.kyc_review_note THEN
    IF NOT (NEW.kyc_review_note IS NULL AND NEW.kyc_status = 'pending') THEN
      RAISE EXCEPTION
        'a therapist may only clear kyc_review_note while resubmitting, never set it'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

COMMENT ON FUNCTION therapists_guard_kyc_columns() IS
  'Column-level guard for the KYC verdict. therapists_update authorises the row, not its columns, so without this the row owner can set their own kyc_status to verified.';

DROP TRIGGER IF EXISTS therapists_guard_kyc_trigger ON therapists;

CREATE TRIGGER therapists_guard_kyc_trigger
  BEFORE INSERT OR UPDATE ON therapists
  FOR EACH ROW EXECUTE FUNCTION therapists_guard_kyc_columns();
