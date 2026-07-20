-- Align the clinical-note delete policy with the application.
--
-- Migration 0001 made deletion admin-only, but `deleteClinicalNoteAction` has
-- always permitted the authoring therapist to delete their own note. The
-- mismatch did not raise an error: RLS simply filtered the row out, the DELETE
-- affected zero rows, and the therapist saw "Not found" for a note plainly
-- visible on screen. A silent divergence between policy and code is worse than
-- either rule on its own, so the two are reconciled here.
--
-- Resolved in favour of the application's existing behaviour (the authoring
-- therapist may delete their own note), because that is what the product did
-- before the migration and narrowing it would silently remove a working feature.
--
-- ⚠️ RETENTION CAVEAT: these are clinical records. Hard deletion by the author
-- may not be what a records-retention or audit obligation requires — under
-- HIPAA-style rules clinical documentation is typically amended and superseded,
-- never destroyed. If that applies here, the correct change is NOT to tighten
-- this policy but to replace hard deletes with a `deleted_at` soft-delete plus
-- an append-only revision history. Flagged rather than silently decided.

DROP POLICY IF EXISTS clinical_notes_delete ON clinical_notes;

CREATE POLICY clinical_notes_delete ON clinical_notes FOR DELETE USING (
  app_owns_therapist(therapist_id) OR app_is_admin()
);
