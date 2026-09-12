-- Close two holes in migration 0018
--
-- Both were found by reading 0018 against the actions built on top of it, and
-- both are the same species of mistake: a guard that looks complete because it
-- covers the *verdict* columns while leaving the *evidence* columns open.
--
-- ── HOLE 1: the evidence was editable after approval ────────────────────────
--
-- 0018's trigger protects `status`, `verification`, `reviewed_at`,
-- `reviewed_by` and `review_note`. It does not protect `jurisdiction`,
-- `subdivision`, `licence_number`, `regulator` or `expires_at` — so the owner
-- of a row could:
--
--   1. Submit a genuine Kenyan licence and have it verified.
--   2. Then UPDATE the row, changing `licence_number` to anything, or
--      `jurisdiction` from 'kenya' to 'united-kingdom'.
--
-- The badge stays `verified` and the reviewer's name stays attached to a
-- credential they never saw. That is worse than self-verifying, because it
-- carries a real reviewer's attestation.
--
-- An application-level check (`assertApplicantEditable`) does guard the one
-- path that exists today. This makes it structural, on the same reasoning
-- 0015 gives for why a whitelist in one function is the wrong place for the
-- guarantee to live: nothing fails when a future action forgets it.
--
-- The columns stay freely editable while `incomplete` or `rejected`, which is
-- how an applicant corrects a typo or responds to a rejection.
--
-- ── HOLE 2: the uniqueness constraint did not constrain ─────────────────────
--
-- `UNIQUE (therapist_id, jurisdiction, subdivision)` is NULLS DISTINCT by
-- default, and `subdivision` is NULL for every national jurisdiction. In SQL
-- two NULLs are not equal, so two rows of ('t1', 'kenya', NULL) both insert
-- and the constraint permits exactly the duplicate it was written to prevent.
--
-- That matters because nothing downstream can then say which row is
-- authoritative: one could be `verified` and the other `rejected`, and the
-- directory's `array_agg(DISTINCT jurisdiction) WHERE status='verified'` would
-- happily advertise the jurisdiction on the strength of the first.
--
-- `NULLS NOT DISTINCT` (PostgreSQL 15+; this runs on 17) makes two NULL
-- subdivisions collide as intended.

-- ── Hole 2 first: the trigger below is easier to reason about against a table
-- that cannot hold duplicates.

-- De-duplicate before tightening, or the constraint cannot be created. Keeps
-- the most advanced row per natural key — a verified licence outranks a
-- pending one, which outranks an untouched draft — so tightening can never
-- discard an approval.
DELETE FROM therapist_licences a
USING therapist_licences b
WHERE a.therapist_id = b.therapist_id
  AND a.jurisdiction = b.jurisdiction
  AND a.subdivision IS NULL AND b.subdivision IS NULL
  AND (
    CASE a.status WHEN 'verified' THEN 3 WHEN 'pending' THEN 2 WHEN 'rejected' THEN 1 ELSE 0 END,
    a.created_at,
    a.id
  ) < (
    CASE b.status WHEN 'verified' THEN 3 WHEN 'pending' THEN 2 WHEN 'rejected' THEN 1 ELSE 0 END,
    b.created_at,
    b.id
  );
-- `a.id` is the final tiebreak, and it is not decoration: `created_at` defaults
-- to `now()`, which is the TRANSACTION timestamp, so two rows written by one
-- statement carry the same value to the microsecond. Ranking on (status,
-- created_at) alone leaves such a pair mutually not-less-than, deletes neither,
-- and the ADD CONSTRAINT below then fails the migration.
--> statement-breakpoint

ALTER TABLE therapist_licences DROP CONSTRAINT IF EXISTS therapist_licences_unique;
--> statement-breakpoint

ALTER TABLE therapist_licences
  ADD CONSTRAINT therapist_licences_unique
  UNIQUE NULLS NOT DISTINCT (therapist_id, jurisdiction, subdivision);
--> statement-breakpoint

-- ── Hole 1: freeze the evidence once it is under review ────────────────────

CREATE OR REPLACE FUNCTION therapist_licences_guard() RETURNS trigger AS $$
DECLARE
  needs_subdivision boolean;
BEGIN
  -- Sub-national jurisdictions must name the state or province, whoever is
  -- writing. Kept in the trigger rather than as a CHECK because the list is
  -- product configuration in `lib/licensing.ts`; a second copy in SQL would
  -- guarantee the two drift. This is the short list that must not silently
  -- lose a subdivision.
  needs_subdivision := NEW.jurisdiction IN ('united-states', 'canada');

  IF needs_subdivision AND (NEW.subdivision IS NULL OR NEW.subdivision = '') THEN
    RAISE EXCEPTION
      'jurisdiction % is licensed sub-nationally; a state or province is required',
      NEW.jurisdiction
      USING ERRCODE = 'check_violation';
  END IF;

  -- Admins review licences; that is the job. Nothing below applies to them.
  IF app_is_admin() THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-created licence starts unverified, always.
    IF NEW.status <> 'incomplete' THEN
      RAISE EXCEPTION
        'status must be ''incomplete'' on a self-created licence (got %)', NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL
       OR NEW.review_note IS NOT NULL THEN
      RAISE EXCEPTION 'review fields are set by reviewers, not by applicants'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- `verification` is the reviewer's record of HOW they checked. An applicant
    -- asserting 'named_regulator' would be writing the reviewer's conclusion.
    IF NEW.verification <> 'case_by_case' THEN
      RAISE EXCEPTION 'verification is recorded by the reviewer, not the applicant'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- ── NEW IN 0019: the evidence is frozen once it leaves the applicant ──────
  --
  -- Editable while `incomplete` or `rejected` — that is how a typo gets fixed
  -- and how a rejection gets answered. Frozen at `pending`, because a reviewer
  -- must assess the same document the applicant submitted; and frozen at
  -- `verified`, because otherwise an approved row can have its licence number
  -- or its country swapped while keeping the reviewer's attestation.
  --
  -- Adding a licence for a NEW jurisdiction is unaffected: that is an INSERT
  -- of another row, which is the whole point of the table.
  IF OLD.status IN ('pending', 'verified') THEN
    IF NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
       OR NEW.subdivision IS DISTINCT FROM OLD.subdivision
       OR NEW.licence_number IS DISTINCT FROM OLD.licence_number
       OR NEW.regulator IS DISTINCT FROM OLD.regulator
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.document_id IS DISTINCT FROM OLD.document_id
       -- `submitted_at` is part of the review trail, not evidence, but it is
       -- frozen for the same reason: it dates the thing the reviewer looked at.
       -- The submit path only ever writes it while moving out of
       -- incomplete/rejected, so this cannot block a legitimate submission.
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION
        'licence details cannot be changed while the licence is % — withdraw it or ask an admin',
        OLD.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- A licence may not be moved to another therapist, at any status. Without
  -- this, `app_owns_therapist` is checked against the row you are writing, so
  -- re-pointing `therapist_id` at someone else would pass the policy on the
  -- way out and hand them a credential.
  IF NEW.therapist_id IS DISTINCT FROM OLD.therapist_id THEN
    RAISE EXCEPTION 'a licence cannot be reassigned to another therapist'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The one transition an applicant may make: submitting for review.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status IN ('incomplete', 'rejected') AND NEW.status = 'pending') THEN
      RAISE EXCEPTION
        'a therapist may only move their own licence from incomplete/rejected to pending (attempted % -> %)',
        OLD.status, NEW.status
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.verification IS DISTINCT FROM OLD.verification THEN
    RAISE EXCEPTION 'verification may only be written by an admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by THEN
    RAISE EXCEPTION 'reviewed_at/reviewed_by may only be written by an admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Narrower, mirroring 0015: an applicant may CLEAR the note as part of
  -- resubmitting, so a stale "your licence had expired" is not left beside a
  -- fresh submission. Writing an arbitrary value would let them author text
  -- attributed to a reviewer.
  IF NEW.review_note IS DISTINCT FROM OLD.review_note THEN
    IF NOT (NEW.review_note IS NULL AND NEW.status = 'pending') THEN
      RAISE EXCEPTION
        'a therapist may only clear review_note while resubmitting, never set it'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
--> statement-breakpoint

COMMENT ON FUNCTION therapist_licences_guard() IS
  'Column-level guard for licence verdicts AND evidence. Without it a therapist could self-verify in a jurisdiction nobody assessed them in, or swap the licence number under an approved badge while keeping the reviewer''s attestation.';
