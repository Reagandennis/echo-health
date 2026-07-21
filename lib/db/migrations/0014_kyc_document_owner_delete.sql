-- Let a therapist remove their own KYC document — while it is still theirs to remove
--
-- `kyc_documents_delete` (migration 0001) was `USING (app_is_admin())`. Only an
-- admin could delete. That was survivable while the onboarding form had a single
-- optional file input and no way to replace anything, but migration 0013 made
-- documents typed and replaceable: the uploader deletes the superseded row
-- before inserting its replacement.
--
-- The failure mode is the quiet one RLS always produces. `deleteKycDocumentAction`
-- passes its ownership check, issues the DELETE, matches zero rows, and returns
-- as though it worked. The application layer now raises on an empty
-- `.returning()` rather than reporting success — but a loud error on a normal
-- action is still a broken flow. The policy is the actual fix.
--
-- WHY THE STATUS PREDICATE, and not just ownership:
--
-- A document is evidence. Once an application is `pending` a reviewer is looking
-- at it, and once `verified` a decision has been made in reliance on it.
-- Withdrawing it in either state destroys the basis of a decision that is still
-- being made or has already been made — and on a clinical credentialing trail
-- that is precisely the thing you cannot allow to happen silently.
--
-- So the therapist may remove documents only while the application is theirs to
-- edit: `incomplete` (not yet submitted) or `rejected` (handed back to them).
-- This duplicates the check in `deleteKycDocumentAction` deliberately, per the
-- project's two-layer rule — the application check fails loudly with "Forbidden",
-- which the UI and audit trail need; this one is the guarantee that holds even
-- if a future caller forgets.
--
-- An accepted document CAN still be replaced during a resubmission. That is
-- intended: its replacement inserts at `review_status = 'pending'`, so it
-- resurfaces as un-reviewed rather than inheriting the old decision, and the
-- `document_accepted` event for the original remains in `kyc_review_events`.
-- A reviewer can therefore see that something previously accepted was swapped.

DROP POLICY kyc_documents_delete ON kyc_documents;

CREATE POLICY kyc_documents_delete ON kyc_documents FOR DELETE USING (
  app_is_admin()
  OR (
    app_owns_therapist(therapist_id)
    AND EXISTS (
      SELECT 1
      FROM therapists t
      WHERE t.id = kyc_documents.therapist_id
        AND t.kyc_status IN ('incomplete', 'rejected')
    )
  )
);

COMMENT ON POLICY kyc_documents_delete ON kyc_documents IS
  'Admins always. Therapists only while their application is incomplete or rejected — a document under review, or one an approval already relied on, must not be withdrawable.';
