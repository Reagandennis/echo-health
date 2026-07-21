-- Let the risk scanner file alerts, and let a reviewer say an alert was noise
--
-- ─── Part 1: the scanner cannot currently write at all ───────────────────────
--
-- `risk_alerts_all` (migration 0001) is `FOR ALL USING (app_is_admin())`. The
-- scanner runs inside `sendMessageAction`, whose caller is a client or a
-- therapist, so its INSERT is refused:
--
--     ERROR: new row violates row-level security policy for table "risk_alerts"
--
-- Two policies rather than one `FOR ALL`. The scanner needs SELECT (to dedupe
-- against the last 24 hours) and INSERT, and nothing else — it has no business
-- resolving an alert or deleting one. `FOR ALL` would hand it both, and a
-- background job that can silently delete clinical alerts is a strictly worse
-- position than one that cannot write them.
--
-- WHY SYSTEM CONTEXT AND NOT "LET SENDERS INSERT". `risk_alerts.patient_id` is
-- free text with no foreign key. Granting senders INSERT would let any client
-- file a `crisis` alert against ANY OTHER user's id — on a table only admins
-- read, and therefore only admins act on. That is a defamation vector wearing a
-- clinical label. System context carries no user identity at all, so nothing a
-- request body says can steer which patient an alert lands on.

CREATE POLICY risk_alerts_system_select ON risk_alerts
  FOR SELECT USING (app_is_system());

CREATE POLICY risk_alerts_system_insert ON risk_alerts
  FOR INSERT WITH CHECK (app_is_system());

-- ─── Part 2: distinguishing "we checked, it was nothing" from "handled" ──────
--
-- `resolved` is a boolean, so closing an alert records only that somebody
-- closed it. It cannot express the difference between:
--
--     "we read the message, it said 'goodbye, see you Tuesday', it was noise"
--     "this person was in crisis and we intervened"
--
-- Both leave an identical row. Over months the table accumulates as an
-- undifferentiated risk history on a real person's record, and the next reader —
-- a new admin, a clinician, an insurer, a court — sees a pattern of crises that
-- is mostly a pattern of substring matches. The word "risk_alerts" does work the
-- data cannot support.
--
-- That matters more here than it would elsewhere because of what the detector
-- is: substring matching over a fixed word list. `goodbye` is on the high-risk
-- list. A cheerful sign-off files a permanent crisis alert against a client.
-- Without a way to record dismissal AS dismissal, every false positive is
-- indistinguishable from a real event that was dealt with.
--
-- `open` is the default so an unreviewed alert is never mistaken for a judged
-- one. `duplicate` is separate from `false_positive` because "the scanner fired
-- twice on one episode" and "the scanner was wrong" are different facts about
-- the detector, and someone tuning the word list needs to tell them apart.
CREATE TYPE risk_alert_disposition AS ENUM (
  'open',
  'actioned',
  'false_positive',
  'duplicate'
);

ALTER TABLE risk_alerts
  ADD COLUMN disposition risk_alert_disposition NOT NULL DEFAULT 'open',
  -- Who judged it, and when. Null while open. Without these, a disposition is
  -- an opinion with no author, which on a clinical record is not much better
  -- than no opinion.
  ADD COLUMN disposition_by text,
  ADD COLUMN disposition_at timestamptz,
  ADD COLUMN disposition_note varchar(1000);

-- `resolved` is kept rather than dropped: it carries an index
-- (`risk_alerts_resolved_idx`) and existing reads use it. This CHECK makes the
-- two columns incapable of disagreeing, so neither can be updated alone and
-- leave the row saying two different things about the same alert.
ALTER TABLE risk_alerts
  ADD CONSTRAINT risk_alerts_disposition_matches_resolved
    CHECK (resolved = (disposition <> 'open'));

-- A judged alert must say who judged it. An anonymous "false positive" on a
-- clinical record is the same failure as the fabricated review states that were
-- just removed from the KYC screens.
ALTER TABLE risk_alerts
  ADD CONSTRAINT risk_alerts_disposition_is_attributed
    CHECK (
      disposition = 'open'
      OR (disposition_by IS NOT NULL AND disposition_at IS NOT NULL)
    );

COMMENT ON COLUMN risk_alerts.disposition IS
  'What a reviewer concluded. false_positive means the scanner was wrong — recording that is what stops this table becoming a keyword-match log that reads as a crisis history.';

CREATE INDEX risk_alerts_disposition_idx ON risk_alerts (disposition, created_at DESC);
