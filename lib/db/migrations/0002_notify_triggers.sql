-- Realtime change notifications
--
-- Replaces Appwrite's realtime subscriptions. Row changes emit a `pg_notify`
-- on the `echo_changes` channel; a single LISTEN connection per Node process
-- (lib/db/events.ts) receives them and fans out to browser clients over SSE.
--
-- WHY ONE SHARED LISTENER: this Azure tier allows ~24 application connections
-- (max_connections 50, less superuser reserve and Azure's own processes). A
-- naive "one LISTEN per connected browser" design would exhaust the server at
-- roughly 24 concurrent users. Fan-out therefore happens in application memory,
-- not in Postgres.
--
-- PAYLOAD BUDGET: pg_notify payloads are capped at 8000 bytes. We deliberately
-- send only identifiers — never row contents — so the cap can never be hit by a
-- long journal entry or chat message. Clients refetch through the normal
-- RLS-protected queries, which also means a notification can never leak data
-- the recipient is not allowed to read.
--
-- AUDIENCE: TG_ARGV carries the names of the columns identifying who should be
-- told about this row. They are read generically from the row via to_jsonb, so
-- one trigger function serves every table.

CREATE OR REPLACE FUNCTION notify_change() RETURNS trigger
  LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  audience text[] := ARRAY[]::text[];
  col text;
  val text;
BEGIN
  row_data := to_jsonb(COALESCE(NEW, OLD));

  FOREACH col IN ARRAY TG_ARGV LOOP
    val := row_data ->> col;
    IF val IS NOT NULL THEN
      audience := array_append(audience, val);
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

-- ─── Triggers ────────────────────────────────────────────────────────────────
-- Only tables with a live subscription in the UI. Adding one elsewhere is a
-- one-line CREATE TRIGGER; leaving them off keeps notification volume down.

-- Direct messages: both ends of the conversation care.
CREATE TRIGGER messages_notify
  AFTER INSERT OR UPDATE OR DELETE ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_change('sender_id', 'receiver_id');

-- Notification bell.
CREATE TRIGGER notifications_notify
  AFTER INSERT OR UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_change('user_id');

-- Session status changes (confirmed / cancelled / completed) and WebRTC track
-- publication. `therapist_id` is a therapists.id row reference rather than a
-- user id, so the listener resolves it before delivering to the clinician.
CREATE TRIGGER therapy_sessions_notify
  AFTER INSERT OR UPDATE ON therapy_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_change('patient_id', 'therapist_id');

-- Support chat. Audience is the opaque client-generated session id, not a user
-- id, because these rows belong to anonymous visitors.
CREATE TRIGGER chat_messages_notify
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_change('session_id');

CREATE TRIGGER chat_sessions_notify
  AFTER INSERT OR UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_change('session_id');

-- The listener connects as echo_app and only needs to receive notifications;
-- LISTEN requires no table privileges of its own.
