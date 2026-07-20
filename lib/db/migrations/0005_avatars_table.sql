-- Separate avatars from KYC documents.
--
-- The Appwrite port routed BOTH profile photos and identity documents through
-- one upload action into `kyc_documents`. They have opposite sensitivity:
--
--   • A therapist's avatar is shown in the PUBLIC provider directory, which
--     unauthenticated visitors browse when choosing a clinician.
--   • A KYC document is a government ID or professional licence, readable only
--     by its owner and an admin.
--
-- Storing them together forced one policy to win. The strict KYC policy did, so
-- avatars were unreadable to the directory that needs them; loosening it to fix
-- that would have exposed identity documents. They need separate tables.

CREATE TABLE avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Auth0 sub of the owner. Not an FK: clients have avatars too, and there is
  -- no users table — identity lives in Auth0.
  owner_id text NOT NULL,
  filename varchar(255) NOT NULL,
  mime_type varchar(128) NOT NULL,
  size_bytes integer NOT NULL,
  content bytea NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX avatars_owner_id_idx ON avatars (owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON avatars TO echo_app;

ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatars FORCE ROW LEVEL SECURITY;

-- Readable by anyone: these render in the public therapist directory, which is
-- itself `USING (true)` for the same reason (see therapists_select).
CREATE POLICY avatars_select ON avatars FOR SELECT USING (true);

-- But only you may create, replace or remove your own.
CREATE POLICY avatars_insert ON avatars FOR INSERT WITH CHECK (
  owner_id = app_user_id()
);
CREATE POLICY avatars_update ON avatars FOR UPDATE
  USING (owner_id = app_user_id()) WITH CHECK (owner_id = app_user_id());
CREATE POLICY avatars_delete ON avatars FOR DELETE USING (
  owner_id = app_user_id() OR app_is_admin()
);
