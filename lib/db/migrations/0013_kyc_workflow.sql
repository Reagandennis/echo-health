-- Therapist KYC workflow
--
-- WHAT WAS WRONG. "KYC" was a single enum column on `therapists` and a bag of
-- untyped file uploads. There was no way to express which documents a clinician
-- had actually provided, no per-document decision, no reason attached to a
-- rejection, and no record of who decided what or when beyond a bare
-- `reviewed_at` stamp. The admin review screen filled those gaps with hardcoded
-- values: it displayed "Government ID — Verified" unconditionally, derived
-- "Background Check — Verified" from the KYC flag, and printed a fabricated
-- licence type, issuing authority and expiry date. Both therapists in this
-- database were approved with ZERO rows in `kyc_documents`. Nothing was ever
-- reviewed, and the screen said otherwise.
--
-- On a teletherapy platform that is not a cosmetic defect. "We verified this
-- clinician's licence" is a claim with legal weight, made to patients, and it
-- was being asserted by a UI against data that did not exist.
--
-- WHAT THIS MIGRATION ESTABLISHES:
--   1. Documents have a TYPE, so "did they provide a practising certificate"
--      is answerable by a query rather than by opening files one at a time.
--   2. Documents have their own review state and note, so an admin can accept
--      four and reject one with a reason, instead of one all-or-nothing flag.
--   3. Decisions are recorded in an append-only trail with an actor. This is
--      the part that makes the process defensible after the fact.
--   4. Every currently-approved therapist is revoked, because none of them were
--      actually verified.

-- ─── Document taxonomy ───────────────────────────────────────────────────────
--
-- Deliberately a short list. A long one invites the applicant to upload
-- something adjacent to what was asked for and call it done; a reviewer then has
-- to decide whether "certificate" meant a degree or a licence. Keep additions
-- rare and specific.
--
-- 'other' exists because reviewers ask for supplementary evidence that no fixed
-- list anticipates. It is never required and never satisfies a requirement.
CREATE TYPE kyc_document_type AS ENUM (
  'government_id',
  'professional_license',
  'practising_certificate',
  'qualification',
  'insurance',
  'other'
);

-- Per-document decision, distinct from the therapist's overall `kyc_status`.
-- A therapist can sit at 'pending' overall while three of their five documents
-- are already accepted — which is what lets a reviewer resume rather than
-- restart.
CREATE TYPE kyc_doc_review AS ENUM ('pending', 'accepted', 'rejected');

-- The two-step default is deliberate.
--
-- There are existing rows (two, uploaded through the old untyped flow), so a
-- bare NOT NULL cannot be added. But leaving a default in place would let a
-- future insert omit the type and silently land as 'other' — reintroducing
-- exactly the untyped upload this column exists to prevent.
--
-- So: backfill the legacy rows, then DROP the default. Historic rows get an
-- honest 'other' marker meaning "uploaded before types existed, nobody stated
-- what this is"; every new row must state a type or the insert fails.
ALTER TABLE kyc_documents
  ADD COLUMN doc_type kyc_document_type NOT NULL DEFAULT 'other',
  ADD COLUMN review_status kyc_doc_review NOT NULL DEFAULT 'pending',
  ADD COLUMN review_note varchar(1000);

ALTER TABLE kyc_documents ALTER COLUMN doc_type DROP DEFAULT;

-- The legacy uploads carry a reviewer stamp from the old flow, which recorded
-- that someone clicked approve — not that anyone assessed the document. Clear
-- it, so the trail does not imply a review that the new workflow would consider
-- to have happened. The files themselves are untouched.
UPDATE kyc_documents
SET review_status = 'pending', reviewed_by = NULL, reviewed_at = NULL
WHERE reviewed_at IS NOT NULL;

COMMENT ON COLUMN kyc_documents.doc_type IS
  'What the applicant says this document is. Required — an untyped document cannot be reviewed against a requirement.';
COMMENT ON COLUMN kyc_documents.review_note IS
  'Reviewer''s reason, shown TO THE THERAPIST on rejection. Write it as if they will read it, because they will.';

CREATE INDEX kyc_documents_review_status_idx ON kyc_documents (review_status);

-- ─── Therapist-level review state ────────────────────────────────────────────

ALTER TABLE therapists
  ADD COLUMN kyc_submitted_at timestamptz,
  ADD COLUMN kyc_reviewed_at timestamptz,
  ADD COLUMN kyc_reviewed_by text,
  ADD COLUMN kyc_review_note varchar(1000);

COMMENT ON COLUMN therapists.kyc_submitted_at IS
  'When the applicant last submitted for review. Distinct from created_at: a rejected applicant resubmits, and the queue sorts on this.';
COMMENT ON COLUMN therapists.kyc_review_note IS
  'Overall decision reason, surfaced to the therapist. On rejection this is the only explanation they get, so it must stand alone.';

-- ─── Append-only decision trail ──────────────────────────────────────────────
--
-- Separate from the columns above because those hold CURRENT state and are
-- overwritten on each decision. The question a regulator, an insurer or a
-- wrongful-credentialing claim asks is not "what is this therapist's status" but
-- "who approved them, when, on what evidence, and had anyone raised a concern
-- before that". Only a trail answers it.
--
-- No UPDATE or DELETE is granted below. A trail that can be edited answers
-- nothing.
CREATE TABLE kyc_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- Auth0 sub of whoever acted. 'system' for automated transitions, which is
  -- why this is text rather than a FK to anything.
  actor_id text NOT NULL,

  -- Free text rather than an enum: this table is a log, and a log that rejects
  -- writes because a new action name was introduced has failed at its one job.
  -- Values in use: submitted, approved, rejected, changes_requested, revoked,
  -- document_accepted, document_rejected.
  action text NOT NULL,

  note varchar(1000),

  -- Which document the event concerns, when it concerns one. Null for
  -- therapist-level decisions. ON DELETE SET NULL so removing a superseded
  -- document does not erase the fact that it was once rejected.
  document_id uuid REFERENCES kyc_documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX kyc_review_events_therapist_idx ON kyc_review_events (therapist_id, created_at DESC);

ALTER TABLE kyc_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_review_events FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON kyc_review_events TO echo_app;
-- Listing two privileges in a GRANT does not withhold the others; the default
-- ACL may already carry them. Revoke explicitly — this is the same invisible
-- grant that left DELETE live on `payments` (migration 0012).
REVOKE UPDATE, DELETE, TRUNCATE ON kyc_review_events FROM echo_app;

-- The therapist can read their own history: they are entitled to know why they
-- were rejected and by which decision. They cannot write to it.
CREATE POLICY kyc_review_events_select ON kyc_review_events FOR SELECT USING (
  app_is_admin() OR app_owns_therapist(therapist_id)
);

-- Admin-only insert. A therapist who could append to their own review trail
-- could manufacture an approval event.
CREATE POLICY kyc_review_events_insert ON kyc_review_events FOR INSERT WITH CHECK (
  app_is_admin()
);

-- No UPDATE or DELETE policy, deliberately, in addition to the REVOKE above.

-- ─── Revoke every existing approval ──────────────────────────────────────────
--
-- Requested explicitly, and correct regardless: every 'verified' therapist in
-- this database was approved against zero documents, through a screen that
-- displayed verification states nobody had established. Those approvals record
-- a check that did not happen, so they are withdrawn rather than grandfathered.
--
-- To 'incomplete', not 'pending': there is nothing in the queue to re-review.
-- They must submit documents through the new flow, which is the entire point.
--
-- This does NOT remove their Auth0 'therapist' role — Auth0 is a separate system
-- with no transactional relationship to this one. Run
-- `npx tsx scripts/revoke-therapist-roles.ts` to complete the revocation.
-- Until that runs, a revoked therapist keeps portal access on their next login.
INSERT INTO kyc_review_events (therapist_id, actor_id, action, note)
SELECT
  id,
  'system',
  'revoked',
  'Approval withdrawn by migration 0013. The prior review recorded no documents ' ||
  'and the review screen asserted verification states that were hardcoded. ' ||
  'Resubmission through the document workflow is required.'
FROM therapists
WHERE kyc_status = 'verified';

UPDATE therapists
SET kyc_status = 'incomplete',
    kyc_reviewed_at = NULL,
    kyc_reviewed_by = NULL,
    kyc_review_note = 'Previous approval withdrawn — please resubmit your documents for review.',
    updated_at = now()
WHERE kyc_status = 'verified';
