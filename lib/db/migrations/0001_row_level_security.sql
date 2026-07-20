-- Row-Level Security
--
-- Restores the per-row isolation lost when the Appwrite ACLs died in the Auth0
-- migration. Under Appwrite, `Permission.read(Role.user(id))` meant the
-- datastore enforced that user A could not read user B's clinical notes. After
-- moving to Auth0 those grants referenced users that no longer existed, leaving
-- ~47 hand-written ownership checks in application code as the ONLY guard.
-- These policies put enforcement back in the database, so a forgotten check in
-- a route handler stops being a data breach.
--
-- Identity arrives per-transaction via `set_config('app.user_id', …, true)`,
-- set by `withUser()` in lib/db/session.ts. The trailing `true` scopes it to
-- the transaction, which is required: connections are pooled and reused across
-- requests, so a session-scoped setting would leak one user's identity into the
-- next request served on that connection.
--
-- NOTE: `echo_admin` owns these tables and has BYPASSRLS, so migrations and
-- admin tooling are unaffected. The application connects as `echo_app`, which
-- does not. FORCE ROW LEVEL SECURITY is also set so table ownership alone never
-- exempts a role.

-- ─── Identity helpers ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_has_role(target text) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT target = ANY(
    string_to_array(coalesce(current_setting('app.user_roles', true), ''), ',')
  )
$$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_has_role('admin') $$;

-- SECURITY DEFINER: this reads profiles/therapists to answer the question and
-- would otherwise recurse into the very policies that call it.
CREATE OR REPLACE FUNCTION app_treats(patient text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN therapists t ON t.id = p.therapist_id
    WHERE p.user_id = patient
      AND t.user_id = app_user_id()
  )
$$;

-- True when the given therapists.id row belongs to the calling user.
CREATE OR REPLACE FUNCTION app_owns_therapist(therapist uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM therapists t
    WHERE t.id = therapist AND t.user_id = app_user_id()
  )
$$;

REVOKE ALL ON FUNCTION app_treats(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_owns_therapist(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_user_id(), app_has_role(text), app_is_admin(),
  app_treats(text), app_owns_therapist(uuid) TO echo_app;

-- ─── profiles ────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON profiles FOR SELECT USING (
  user_id = app_user_id()
  OR app_is_admin()
  -- Therapists may read the profile of a patient assigned to them.
  OR (app_has_role('therapist') AND app_treats(user_id))
);

CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (
  user_id = app_user_id() OR app_is_admin()
);

CREATE POLICY profiles_update ON profiles FOR UPDATE
  USING (user_id = app_user_id() OR app_is_admin())
  WITH CHECK (user_id = app_user_id() OR app_is_admin());

CREATE POLICY profiles_delete ON profiles FOR DELETE USING (app_is_admin());

-- ─── therapists ──────────────────────────────────────────────────────────────
-- The therapist directory is intentionally public: visitors browse it when
-- choosing a provider, before authenticating.

ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapists FORCE ROW LEVEL SECURITY;

CREATE POLICY therapists_select ON therapists FOR SELECT USING (true);

CREATE POLICY therapists_insert ON therapists FOR INSERT WITH CHECK (
  user_id = app_user_id() OR app_is_admin()
);

CREATE POLICY therapists_update ON therapists FOR UPDATE
  USING (user_id = app_user_id() OR app_is_admin())
  WITH CHECK (user_id = app_user_id() OR app_is_admin());

CREATE POLICY therapists_delete ON therapists FOR DELETE USING (app_is_admin());

-- ─── therapy_sessions ────────────────────────────────────────────────────────

ALTER TABLE therapy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapy_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY therapy_sessions_select ON therapy_sessions FOR SELECT USING (
  patient_id = app_user_id()
  OR app_owns_therapist(therapist_id)
  OR app_is_admin()
);

CREATE POLICY therapy_sessions_insert ON therapy_sessions FOR INSERT WITH CHECK (
  patient_id = app_user_id() OR app_is_admin()
);

CREATE POLICY therapy_sessions_update ON therapy_sessions FOR UPDATE
  USING (
    patient_id = app_user_id()
    OR app_owns_therapist(therapist_id)
    OR app_is_admin()
  )
  WITH CHECK (
    patient_id = app_user_id()
    OR app_owns_therapist(therapist_id)
    OR app_is_admin()
  );

CREATE POLICY therapy_sessions_delete ON therapy_sessions FOR DELETE USING (app_is_admin());

-- ─── messages ────────────────────────────────────────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

CREATE POLICY messages_select ON messages FOR SELECT USING (
  sender_id = app_user_id() OR receiver_id = app_user_id() OR app_is_admin()
);

-- You may only send as yourself.
CREATE POLICY messages_insert ON messages FOR INSERT WITH CHECK (
  sender_id = app_user_id() OR app_is_admin()
);

CREATE POLICY messages_delete ON messages FOR DELETE USING (app_is_admin());

-- ─── mood_logs ───────────────────────────────────────────────────────────────

ALTER TABLE mood_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY mood_logs_select ON mood_logs FOR SELECT USING (
  user_id = app_user_id()
  OR app_is_admin()
  OR (app_has_role('therapist') AND app_treats(user_id))
);

CREATE POLICY mood_logs_insert ON mood_logs FOR INSERT WITH CHECK (
  user_id = app_user_id()
);

CREATE POLICY mood_logs_update ON mood_logs FOR UPDATE
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

CREATE POLICY mood_logs_delete ON mood_logs FOR DELETE USING (
  user_id = app_user_id() OR app_is_admin()
);

-- ─── journal_entries ─────────────────────────────────────────────────────────
-- Deliberately the strictest table here: private to the author, with no
-- therapist and no admin read path. Mirrors the Appwrite original, where no
-- therapist read route existed.

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries FORCE ROW LEVEL SECURITY;

CREATE POLICY journal_entries_all ON journal_entries FOR ALL
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());

-- ─── goals ───────────────────────────────────────────────────────────────────

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals FORCE ROW LEVEL SECURITY;

CREATE POLICY goals_select ON goals FOR SELECT USING (
  user_id = app_user_id()
  OR app_is_admin()
  OR (app_has_role('therapist') AND app_treats(user_id))
);

-- Therapists may assign goals to their own patients.
CREATE POLICY goals_insert ON goals FOR INSERT WITH CHECK (
  user_id = app_user_id()
  OR app_is_admin()
  OR (app_has_role('therapist') AND app_treats(user_id))
);

CREATE POLICY goals_update ON goals FOR UPDATE
  USING (
    user_id = app_user_id()
    OR app_is_admin()
    OR (app_has_role('therapist') AND app_treats(user_id))
  )
  WITH CHECK (
    user_id = app_user_id()
    OR app_is_admin()
    OR (app_has_role('therapist') AND app_treats(user_id))
  );

CREATE POLICY goals_delete ON goals FOR DELETE USING (
  user_id = app_user_id() OR app_is_admin()
);

-- ─── clinical_notes ──────────────────────────────────────────────────────────
-- Authored by clinicians about patients. The patient is NOT granted read
-- access: `is_private` defaulted to true and no patient read path existed.

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY clinical_notes_select ON clinical_notes FOR SELECT USING (
  app_owns_therapist(therapist_id) OR app_is_admin()
);

CREATE POLICY clinical_notes_insert ON clinical_notes FOR INSERT WITH CHECK (
  app_owns_therapist(therapist_id)
);

CREATE POLICY clinical_notes_update ON clinical_notes FOR UPDATE
  USING (app_owns_therapist(therapist_id))
  WITH CHECK (app_owns_therapist(therapist_id));

CREATE POLICY clinical_notes_delete ON clinical_notes FOR DELETE USING (app_is_admin());

-- ─── session_feedback ────────────────────────────────────────────────────────

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_feedback FORCE ROW LEVEL SECURITY;

CREATE POLICY session_feedback_select ON session_feedback FOR SELECT USING (
  user_id = app_user_id() OR app_is_admin()
);

CREATE POLICY session_feedback_insert ON session_feedback FOR INSERT WITH CHECK (
  user_id = app_user_id()
);

CREATE POLICY session_feedback_delete ON session_feedback FOR DELETE USING (app_is_admin());

-- ─── notifications ───────────────────────────────────────────────────────────
-- Insert is admin-only: recipient, title and body are all caller-supplied, so
-- an open policy would be a notification-spoofing primitive.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

CREATE POLICY notifications_select ON notifications FOR SELECT USING (
  user_id = app_user_id() OR app_is_admin()
);

CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (app_is_admin());

-- Users may mark their own notifications read.
CREATE POLICY notifications_update ON notifications FOR UPDATE
  USING (user_id = app_user_id() OR app_is_admin())
  WITH CHECK (user_id = app_user_id() OR app_is_admin());

CREATE POLICY notifications_delete ON notifications FOR DELETE USING (
  user_id = app_user_id() OR app_is_admin()
);

-- ─── kyc_documents ───────────────────────────────────────────────────────────

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY kyc_documents_select ON kyc_documents FOR SELECT USING (
  app_owns_therapist(therapist_id) OR app_is_admin()
);

CREATE POLICY kyc_documents_insert ON kyc_documents FOR INSERT WITH CHECK (
  app_owns_therapist(therapist_id)
);

CREATE POLICY kyc_documents_update ON kyc_documents FOR UPDATE USING (app_is_admin());
CREATE POLICY kyc_documents_delete ON kyc_documents FOR DELETE USING (app_is_admin());

-- ─── match_conflicts / risk_alerts ───────────────────────────────────────────
-- Clinical-operations tables. Admin-only, matching the `requireAdmin()` gates
-- added to the corresponding server actions.

ALTER TABLE match_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_conflicts FORCE ROW LEVEL SECURITY;
CREATE POLICY match_conflicts_all ON match_conflicts FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());

ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts FORCE ROW LEVEL SECURITY;
CREATE POLICY risk_alerts_all ON risk_alerts FOR ALL
  USING (app_is_admin()) WITH CHECK (app_is_admin());

-- ─── promos ──────────────────────────────────────────────────────────────────

ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos FORCE ROW LEVEL SECURITY;

CREATE POLICY promos_select ON promos FOR SELECT USING (
  used_by = app_user_id() OR app_is_admin()
);
CREATE POLICY promos_insert ON promos FOR INSERT WITH CHECK (
  used_by = app_user_id() OR app_is_admin()
);
CREATE POLICY promos_update ON promos FOR UPDATE USING (app_is_admin());
CREATE POLICY promos_delete ON promos FOR DELETE USING (app_is_admin());

-- ─── chat_sessions / chat_messages ───────────────────────────────────────────
-- DELIBERATELY NOT BOUND TO user_id.
--
-- Support chat is anonymous-friendly: visitors have no Auth0 identity and rows
-- are keyed by a client-generated `session_id`, not a user. There is no column
-- RLS could bind to for the anonymous case, so authorization for these two
-- tables stays in application code (app/api/chat/*), which matches a visitor by
-- session id and email.
--
-- RLS is enabled with an explicit permissive policy rather than left off, so
-- `pg_tables.rowsecurity` is uniformly true and an audit does not have to guess
-- whether these were simply forgotten.

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_app ON chat_sessions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_app ON chat_messages FOR ALL USING (true) WITH CHECK (true);
