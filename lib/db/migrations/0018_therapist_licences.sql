-- Per-jurisdiction therapist licences
--
-- THE PROBLEM. `therapists.license_number` is a single varchar with no
-- jurisdiction attached, because every clinician was licensed in Kenya and
-- every client got one of them regardless of where they were. The country
-- pages disclose that honestly, but a client in the UK or the US is still
-- receiving therapy from someone their own regulator has never assessed, with
-- no local complaints route and no documentation a local insurer will accept.
--
-- A therapist can now hold one licence per jurisdiction, each verified
-- separately, so matching and the directory can prefer a clinician licensed
-- where the client actually is. `lib/licensing.ts` holds what each
-- jurisdiction requires and — importantly — which entries no qualified local
-- adviser has confirmed yet.
--
-- WHY A TABLE AND NOT MORE COLUMNS. A therapist may hold several licences, and
-- US and Canadian licensure is sub-national: "licensed in the United States"
-- is not a thing, so a licence needs a `subdivision` (state/province) and a
-- therapist licensed in California must not be presentable as licensed
-- countrywide. Columns cannot express one-to-many.
--
-- `therapists.license_number` is deliberately NOT dropped here. It is the
-- Kenyan licence for every existing row, `upsertTherapistProfileAction` still
-- writes it, and the backfill below copies it into this table. Dropping it in
-- the same migration that introduces the replacement means a failed deploy
-- loses the data. Drop it in a later migration once this one has been running.

CREATE TYPE licence_verification AS ENUM ('named_regulator', 'sub_national', 'case_by_case');

CREATE TABLE therapist_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- A market slug from `lib/markets.ts` (kenya, united-kingdom, …). Plain text
  -- rather than an enum: the market list is product configuration that changes
  -- without a migration, and an enum would make adding a market a schema change.
  jurisdiction text NOT NULL,

  -- State or province. REQUIRED where `lib/licensing.ts` says the jurisdiction
  -- is sub-national — enforced by the trigger below, not by NOT NULL, because
  -- it must stay null for the national cases.
  subdivision text,

  -- The body that issued it, as the reviewer recorded it. Free text on purpose:
  -- for `case_by_case` jurisdictions Echo has not established which body is
  -- authoritative, and an enum would force a reviewer to pick a wrong answer.
  regulator text,
  licence_number varchar(128),

  -- How this was checked. Recorded per licence rather than read from
  -- `lib/licensing.ts` at display time, so the claim made to a client is the
  -- claim the reviewer actually verified — if the requirements file is later
  -- corrected, history does not silently change with it.
  verification licence_verification NOT NULL DEFAULT 'case_by_case',

  -- Reuses the existing kyc_status enum so a licence and an application speak
  -- the same language: incomplete → pending → verified / rejected.
  status kyc_status NOT NULL DEFAULT 'incomplete',

  expires_at date,

  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  -- Shown to the therapist on a rejection. The only explanation they get.
  review_note varchar(1000),

  -- The evidence. SET NULL rather than CASCADE: deleting a document must not
  -- silently delete the record that a licence was verified.
  document_id uuid REFERENCES kyc_documents(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One licence per therapist per jurisdiction+subdivision. Two rows for
  -- California would let one be verified and the other pending, and nothing
  -- downstream could say which is authoritative.
  CONSTRAINT therapist_licences_unique
    UNIQUE (therapist_id, jurisdiction, subdivision)
);
--> statement-breakpoint

CREATE INDEX therapist_licences_therapist_idx ON therapist_licences (therapist_id);
--> statement-breakpoint
-- Serves the directory's "find me someone licensed where I am" query.
CREATE INDEX therapist_licences_lookup_idx
  ON therapist_licences (jurisdiction, status) WHERE status = 'verified';
--> statement-breakpoint

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Every existing therapist with a licence number holds a Kenyan one. Imported
-- as `verified` only where the therapist themselves is verified: a pending
-- applicant's unchecked number must not arrive as a verified licence.
INSERT INTO therapist_licences
  (therapist_id, jurisdiction, regulator, licence_number, verification, status,
   submitted_at, reviewed_at, reviewed_by)
SELECT
  t.id,
  'kenya',
  'Counsellors and Psychologists Board',
  t.license_number,
  'named_regulator',
  t.kyc_status,
  t.kyc_submitted_at,
  t.kyc_reviewed_at,
  t.kyc_reviewed_by
FROM therapists t
WHERE t.license_number IS NOT NULL AND t.license_number <> ''
ON CONFLICT (therapist_id, jurisdiction, subdivision) DO NOTHING;
--> statement-breakpoint

-- ─── Row-level security ──────────────────────────────────────────────────────
ALTER TABLE therapist_licences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE therapist_licences FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- World-readable, like `therapists` itself — the public directory has to be
-- able to say which jurisdictions a clinician is licensed in before anyone
-- signs in. Note this exposes `licence_number`, which is fine and intended:
-- a licence number is public register data, and being checkable is the point.
CREATE POLICY therapist_licences_select ON therapist_licences FOR SELECT USING (true);
--> statement-breakpoint

CREATE POLICY therapist_licences_insert ON therapist_licences FOR INSERT
  WITH CHECK (app_owns_therapist(therapist_id) OR app_is_admin());
--> statement-breakpoint

CREATE POLICY therapist_licences_update ON therapist_licences FOR UPDATE
  USING (app_owns_therapist(therapist_id) OR app_is_admin())
  WITH CHECK (app_owns_therapist(therapist_id) OR app_is_admin());
--> statement-breakpoint

-- Admins only. A therapist removing a rejected licence would erase the record
-- that a jurisdiction had already turned them down.
CREATE POLICY therapist_licences_delete ON therapist_licences FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_licences TO echo_app;
--> statement-breakpoint

-- ─── The column guard ────────────────────────────────────────────────────────
--
-- Exactly the hole migration 0015 closed on `therapists`, and it would be
-- wide open here without this. `therapist_licences_update` authorises the ROW,
-- not the COLUMNS, so the owner of a licence row could write every column on
-- it — including `status`. A therapist could insert a licence for the United
-- Kingdom, set it to `verified`, and be presented to UK clients as
-- HCPC-registered without any reviewer involved.
--
-- That is a worse version of the 0015 bug: self-certifying in a jurisdiction
-- you have never been assessed in, on a mental-health platform.
--
-- Column privileges cannot fix it for the same reason 0015 gives: the app
-- connects as `echo_app` for every user and distinguishes admins only through
-- the `app.user_roles` GUC, so a REVOKE would block admins too.
CREATE OR REPLACE FUNCTION therapist_licences_guard() RETURNS trigger AS $$
DECLARE
  needs_subdivision boolean;
BEGIN
  -- Sub-national jurisdictions must name the state or province, whoever is
  -- writing. Enforced here rather than as a CHECK because the list of
  -- sub-national jurisdictions is product configuration in
  -- `lib/licensing.ts`; keeping it in one place in SQL would guarantee the two
  -- drift. This is the short list that must not silently lose a subdivision.
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
  'Column-level guard for licence verdicts. therapist_licences_update authorises the row, not its columns, so without this a therapist could self-verify a licence in a jurisdiction no reviewer has assessed them in.';
--> statement-breakpoint

DROP TRIGGER IF EXISTS therapist_licences_guard_trigger ON therapist_licences;
--> statement-breakpoint

CREATE TRIGGER therapist_licences_guard_trigger
  BEFORE INSERT OR UPDATE ON therapist_licences
  FOR EACH ROW EXECUTE FUNCTION therapist_licences_guard();
