-- Therapist availability — the storage the feature never had
--
-- `app/therapist/availability/page.tsx` presents a weekly schedule with per-day
-- toggles, start/end times, a session duration and a buffer. Its save handler is:
--
--     function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }
--
-- It sets a local flag, renders "Saved ✓", and discards everything. There is no
-- action, no table, and no request. A clinician configures their working week,
-- receives an explicit confirmation that it was saved, closes the tab, and the
-- schedule is gone. The admin mirror of the same data was a hardcoded grid.
--
-- That is worse than an unbuilt feature, because the success message actively
-- tells the user the opposite of what happened.
--
-- SCOPE, AND WHAT THIS DOES NOT DO. This adds storage and makes the two screens
-- honest. It does NOT yet constrain booking: `createSessionAction` accepts any
-- `scheduledAt` and will continue to. Availability is therefore advisory —
-- published so clients can see when a therapist works, not enforced when they
-- pick a time. Enforcing it is a real change to the booking flow (what happens
-- to an out-of-hours request, who may override, how existing bookings are
-- treated) and deserves its own decision rather than being smuggled in here.
-- Until then, both UIs must describe it as published hours, not as a lock.

-- ─── Timezone ────────────────────────────────────────────────────────────────
--
-- Required, not optional, and this is the reason: "available Monday 09:00–17:00"
-- is meaningless without knowing whose 09:00. The clinicians are in Nairobi and
-- the clients are being marketed to worldwide, so the two ends of every booking
-- are routinely in different zones. Storing wall-clock times with no zone would
-- produce a schedule that is correct only for viewers who happen to share the
-- therapist's offset.
--
-- An IANA name rather than a UTC offset, because offsets change: a fixed +03:00
-- silently becomes wrong for any therapist in a zone that observes DST, and
-- Kenya not observing it today is not a property to hard-code.
ALTER TABLE therapists
  ADD COLUMN timezone text NOT NULL DEFAULT 'Africa/Nairobi',
  -- Both were `useState` values on the page with nowhere to go. Defaults match
  -- what that page displayed, so an existing therapist's screen does not appear
  -- to change under them.
  ADD COLUMN session_duration_minutes integer NOT NULL DEFAULT 50,
  ADD COLUMN buffer_minutes integer NOT NULL DEFAULT 10;

ALTER TABLE therapists
  ADD CONSTRAINT therapists_session_duration_sane
    CHECK (session_duration_minutes BETWEEN 15 AND 240),
  ADD CONSTRAINT therapists_buffer_sane
    CHECK (buffer_minutes BETWEEN 0 AND 120);

COMMENT ON COLUMN therapists.timezone IS
  'IANA zone name. All availability rows for this therapist are expressed in it.';

-- ─── Weekly availability ─────────────────────────────────────────────────────

CREATE TABLE therapist_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,

  -- 0 = Sunday, matching both JavaScript's `Date.getDay()` and Postgres's
  -- `EXTRACT(DOW ...)`. Pinned here because the two common conventions differ by
  -- one and an off-by-one in a schedule is invisible until someone misses an
  -- appointment.
  day_of_week smallint NOT NULL,

  -- Minutes from local midnight rather than `time`. A `time` column invites
  -- comparison against a `timestamptz` elsewhere in the codebase, which silently
  -- involves the SERVER's zone; an integer cannot be accidentally compared to a
  -- moment in time. 1440 is permitted as an end value so a block can run to
  -- midnight.
  start_minute smallint NOT NULL,
  end_minute smallint NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT availability_day_valid CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT availability_start_valid CHECK (start_minute BETWEEN 0 AND 1439),
  CONSTRAINT availability_end_valid CHECK (end_minute BETWEEN 1 AND 1440),
  -- Rejects the zero-length and inverted ranges a UI can produce by letting
  -- someone set an end earlier than a start. Without it, "available 17:00–09:00"
  -- stores cleanly and renders as nonsense.
  CONSTRAINT availability_range CHECK (end_minute > start_minute),

  -- One block per day, matching the screen this replaces, which has exactly one
  -- start and one end per day. Split shifts (09:00–12:00, 14:00–18:00) are a
  -- real pattern and this forbids them — dropping the constraint later is a
  -- one-line migration, whereas a UI written against multiple rows when only one
  -- can exist is a false promise in the other direction.
  CONSTRAINT availability_one_block_per_day UNIQUE (therapist_id, day_of_week)
);

CREATE INDEX therapist_availability_therapist_idx
  ON therapist_availability (therapist_id, day_of_week);

ALTER TABLE therapist_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_availability FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON therapist_availability TO echo_app;

-- World-readable, exactly like `therapists_select`, and for the same reason:
-- visitors browse the directory before signing in, and "when does this
-- clinician work" is part of choosing one. Published working hours are not
-- sensitive — they are the business equivalent of a shop sign.
CREATE POLICY therapist_availability_select ON therapist_availability
  FOR SELECT USING (true);

-- Writes are the owner's or an admin's. `app_owns_therapist` resolves the
-- therapist row to its Auth0 sub, so a therapist cannot publish hours against
-- somebody else's profile.
CREATE POLICY therapist_availability_insert ON therapist_availability
  FOR INSERT WITH CHECK (app_owns_therapist(therapist_id) OR app_is_admin());

CREATE POLICY therapist_availability_update ON therapist_availability
  FOR UPDATE USING (app_owns_therapist(therapist_id) OR app_is_admin())
  WITH CHECK (app_owns_therapist(therapist_id) OR app_is_admin());

-- DELETE is granted because clearing a day is how a therapist says "I do not
-- work Fridays". Unlike the KYC ledgers, this is current configuration rather
-- than a record of a decision, so removing a row destroys nothing that has to be
-- accounted for later.
CREATE POLICY therapist_availability_delete ON therapist_availability
  FOR DELETE USING (app_owns_therapist(therapist_id) OR app_is_admin());

COMMENT ON TABLE therapist_availability IS
  'Published weekly working hours, in the therapist''s own timezone. Advisory: not enforced at booking time.';
