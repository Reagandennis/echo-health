-- Fix two audience bugs in the realtime notifications from migration 0002.
--
-- BUG 1 — therapists never received session events.
-- The `therapy_sessions` trigger put `therapist_id` into the audience, but that
-- column holds a `therapists.id` row uuid, while `/api/events` subscribes
-- clients by their Auth0 `sub`. The two never matched. Migration 0002's comment
-- claimed the listener resolved this; it did not, and no such code existed.
-- Symptom: a clinician waiting in a video room was never told their patient had
-- joined and published tracks.
-- Fix: resolve the therapist row to its owner's Auth0 sub here, in SQL, where
-- the row is already in hand. Doing it in the Node listener would mean a
-- database round-trip per event.
--
-- BUG 2 — staff never received support-chat events.
-- The chat triggers address only the visitor's opaque `session_id`, so the admin
-- inbox (which spans every conversation and knows no single session id) could
-- not subscribe to anything and had to fall back to polling. Fix: also address a
-- constant `staff` token, which `/api/events` subscribes admins and therapists to.
--
-- TG_ARGV convention: an entry may be a bare column name, `therapist:<column>`
-- to resolve a therapists row to its owner, or `const:<literal>` for a fixed token.

CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  row_data jsonb;
  audience text[] := ARRAY[]::text[];
  spec text;
  col text;
  val text;
  resolved text;
BEGIN
  row_data := to_jsonb(COALESCE(NEW, OLD));

  FOREACH spec IN ARRAY TG_ARGV LOOP
    IF spec LIKE 'const:%' THEN
      audience := array_append(audience, substring(spec from 7));

    ELSIF spec LIKE 'therapist:%' THEN
      col := substring(spec from 11);
      val := row_data ->> col;
      IF val IS NOT NULL THEN
        -- SECURITY DEFINER is required for this lookup: the trigger runs as the
        -- invoking user (echo_app), for whom `therapists` is RLS-protected.
        SELECT t.user_id INTO resolved FROM therapists t WHERE t.id = val::uuid;
        IF resolved IS NOT NULL THEN
          audience := array_append(audience, resolved);
        END IF;
      END IF;

    ELSE
      val := row_data ->> spec;
      IF val IS NOT NULL THEN
        audience := array_append(audience, val);
      END IF;
    END IF;
  END LOOP;

  PERFORM pg_notify(
    'echo_changes',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'op', TG_OP,
      'id', row_data ->> 'id',
      'audience', to_jsonb(audience)
    )::text
  );

  RETURN COALESCE(NEW, OLD);
END $$;

-- Re-point the affected triggers at the new argument forms.

DROP TRIGGER IF EXISTS therapy_sessions_notify ON therapy_sessions;
CREATE TRIGGER therapy_sessions_notify
  AFTER INSERT OR UPDATE ON therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_change('patient_id', 'therapist:therapist_id');

DROP TRIGGER IF EXISTS chat_messages_notify ON chat_messages;
CREATE TRIGGER chat_messages_notify
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_change('session_id', 'const:staff');

DROP TRIGGER IF EXISTS chat_sessions_notify ON chat_sessions;
CREATE TRIGGER chat_sessions_notify
  AFTER INSERT OR UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_change('session_id', 'const:staff');

-- `clinical_notes` FKs also point at therapists; add the trigger here so the
-- convention is established in one place if that table ever gains a live view.
