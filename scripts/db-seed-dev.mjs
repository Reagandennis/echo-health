/**
 * Put a handful of therapists in the local database so `/therapists` and the
 * home page have something to render.
 *
 * ## This is LOCAL DEVELOPMENT DATA and the script enforces that
 *
 * AGENTS.md is emphatic that the public site must not present invented people
 * as real clinicians — the home page carried three fabricated therapists over
 * stock photographs, one of whose portraits also appeared on /about under a
 * different name, and removing them is why `/therapists` reads the database at
 * all. Seeding fake rows is the *same class* of thing, and the only reason it
 * is acceptable here is that these rows can never leave this machine:
 *
 *   1. The script REFUSES to run unless the database host is loopback. Not a
 *      warning, not a `--force` flag: it exits.
 *   2. Every row carries `license_number = 'LOCAL-SEED'`, which is never
 *      exposed publicly (`lib/directory.ts` selects columns explicitly and
 *      omits it), so seed rows stay identifiable in the database without
 *      showing up in the UI. `npm run db:seed -- --clear` removes exactly
 *      those rows and nothing else.
 *
 * If you need to demo against a shared database, create real profiles through
 * the therapist onboarding flow and verify them in the admin queue. Do not
 * loosen the guard below.
 *
 *   node scripts/db-seed-dev.mjs
 *   node scripts/db-seed-dev.mjs --clear
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

function loadEnv(name) {
  try {
    for (const line of readFileSync(name, "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      if (process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* Absent file is normal. */
  }
}
loadEnv(".env.local");
loadEnv(".env");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Seeding writes as echo_admin.");
  process.exit(1);
}

/* ── The guard ─────────────────────────────────────────────────────────────
   Hostname must resolve to this machine. Checked before a connection is
   opened, so a misconfigured URL cannot write a single row. */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", "host.docker.internal"]);
let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("DATABASE_URL is not a parseable URL.");
  process.exit(1);
}
if (!LOOPBACK.has(host)) {
  console.error(
    `Refusing to seed: DATABASE_URL points at "${host}", which is not this machine.\n\n` +
      `This script writes therapist profiles that do not correspond to real people.\n` +
      `Putting those in front of anyone looking for mental-health care is the exact\n` +
      `thing AGENTS.md forbids, so the check is not overridable. Point DATABASE_URL\n` +
      `at the local Docker stack (see .env.local) or create real profiles through\n` +
      `the onboarding flow.\n`
  );
  process.exit(1);
}

const sslMode = /[?&]sslmode=([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
const sql = postgres(url, {
  ssl: sslMode === "disable" ? false : "require",
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});

/**
 * Deliberately unglamorous, plausible profiles.
 *
 * Specialties are drawn from `CONDITIONS` in `lib/navigation.ts` so the
 * directory's specialty filter and the condition-page cross-links have
 * something to match on — a seed that produces an unfilterable list does not
 * exercise the thing you are trying to look at.
 *
 * No avatar URLs. `/api/avatar/[id]` serves `bytea` from the `avatars` table,
 * and pointing at ids that do not exist would render broken images; the
 * initials fallback in `TherapistCard` is what a real un-uploaded profile
 * looks like anyway.
 */
const THERAPISTS = [
  {
    userId: "auth0|seed-therapist-1",
    name: "Dr. Wanjiru Kamau",
    experience: 12,
    specialties: ["Anxiety", "Trauma & PTSD", "Stress & burnout"],
    bio:
      "I work mostly with people who are managing a lot and have stopped noticing how much. " +
      "My approach is practical and collaborative — we will look at what is keeping a pattern " +
      "in place rather than only at how it feels.\n\n" +
      "I use cognitive behavioural therapy and trauma-focused approaches, and I will tell you " +
      "plainly if I think someone else would be a better fit for what you need.",
  },
  {
    userId: "auth0|seed-therapist-2",
    name: "Samuel Otieno",
    experience: 8,
    specialties: ["Depression", "Self-esteem", "Relationships"],
    bio:
      "Low mood rarely arrives on its own, and it is usually tangled up with how someone has " +
      "learned to see themselves. I am interested in both.\n\n" +
      "Sessions with me are conversational. I will not hand you a worksheet in the first hour, " +
      "though I will suggest one later if it would help.",
  },
  {
    userId: "auth0|seed-therapist-3",
    name: "Dr. Aisha Mohamed",
    experience: 15,
    specialties: ["Grief & loss", "Trauma & PTSD", "Sleep problems"],
    bio:
      "I have spent most of my career working with bereavement and with the kind of sleep " +
      "problems that follow a difficult period rather than causing one.\n\n" +
      "There is no timetable for grief and I will not imply one. We go at whatever pace the " +
      "work actually needs.",
  },
  {
    userId: "auth0|seed-therapist-4",
    name: "Grace Njoroge",
    experience: 6,
    specialties: ["Anxiety", "Relationships", "Stress & burnout"],
    bio:
      "I work with couples and with individuals thinking through a relationship on their own. " +
      "Much of what I do is slowing a conversation down enough that both people can hear it.\n\n" +
      "I am comfortable with faith coming into the room, and equally comfortable if it does not.",
  },
];

const clear = process.argv.includes("--clear");

try {
  if (clear) {
    const deleted = await sql`
      DELETE FROM therapists WHERE license_number = 'LOCAL-SEED' RETURNING id
    `;
    /* Only the two persona profiles, matched by their exact synthetic ids —
       never a broad `LIKE 'auth0|%'`, which would take real rows with it if
       this were ever pointed somewhere it should not be. */
    const profiles = await sql`
      DELETE FROM profiles
      WHERE user_id IN ('auth0|dev-client', 'auth0|dev-admin')
      RETURNING id
    `;
    console.log(
      `Removed ${deleted.length} seed therapist${deleted.length === 1 ? "" : "s"} ` +
        `and ${profiles.length} persona profile${profiles.length === 1 ? "" : "s"}.`
    );
  } else {
    /*
     * Seeded inside a transaction that carries the admin role, because
     * migration 0015 installs a trigger that refuses a therapist row created
     * already `verified`:
     *
     *   kyc_status must be 'incomplete' on a self-created therapist row
     *
     * That trigger is a real security control — it is what stops a clinician
     * self-certifying, and its comment explains that the only previous guard
     * was one whitelist in one function. `echo_admin`'s BYPASSRLS skips
     * POLICIES, not TRIGGERS, so it fires here too.
     *
     * Setting `app.user_roles = 'admin'` is not a workaround: it is the same
     * context an admin approving a KYC application runs in, and
     * `app_is_admin()` is precisely the check the trigger exempts. The seed
     * therefore takes the legitimate path rather than disabling the guard,
     * which also means this script keeps working if the rules tighten.
     */
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('app.user_roles', 'admin', true)`;
      await tx`SELECT set_config('app.user_id', 'auth0|local-seed-script', true)`;

      for (const t of THERAPISTS) {
        /* `user_id` has a unique index, so a re-run updates rather than
           duplicating. Safe to run repeatedly while iterating on layout. */
        await tx`
          INSERT INTO therapists
            (user_id, name, bio, experience, specialties, kyc_status,
             onboarding_complete, license_number, timezone,
             kyc_submitted_at, kyc_reviewed_at, kyc_reviewed_by)
          VALUES
            (${t.userId}, ${t.name}, ${t.bio}, ${t.experience}, ${t.specialties},
             'verified', true, 'LOCAL-SEED', 'Africa/Nairobi',
             now(), now(), 'auth0|local-seed-script')
          ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            bio = EXCLUDED.bio,
            experience = EXCLUDED.experience,
            specialties = EXCLUDED.specialties,
            kyc_status = EXCLUDED.kyc_status,
            onboarding_complete = EXCLUDED.onboarding_complete,
            updated_at = now()
        `;
      }
    });
    /*
     * Profiles for the personas in `lib/auth/dev-session.ts`.
     *
     * Without these the client portal signs in successfully and then shows an
     * empty shell — `profiles` is the sole record of the therapist↔patient
     * relationship, so no row means no assigned therapist, no sessions and no
     * messages. That looks like a broken app rather than an unseeded one,
     * which is the most confusing possible first impression.
     *
     * The client is linked to the first seeded therapist so the dashboard has
     * someone to show. `user_id` is unique, so re-running updates.
     */
    const [firstTherapist] = await sql`
      SELECT id FROM therapists WHERE user_id = 'auth0|seed-therapist-1' LIMIT 1
    `;

    const PROFILES = [
      {
        userId: "auth0|dev-client",
        name: "Dev Client",
        email: "dev-client@localhost.test",
        goal: "Manage stress and sleep better",
        therapistId: firstTherapist?.id ?? null,
      },
      {
        userId: "auth0|dev-admin",
        name: "Dev Admin",
        email: "dev-admin@localhost.test",
        goal: null,
        therapistId: null,
      },
    ];

    for (const profile of PROFILES) {
      await sql`
        INSERT INTO profiles (user_id, name, email, goal, therapist_id)
        VALUES (${profile.userId}, ${profile.name}, ${profile.email},
                ${profile.goal}, ${profile.therapistId})
        ON CONFLICT (user_id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          goal = EXCLUDED.goal,
          therapist_id = EXCLUDED.therapist_id
      `;
    }

    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM therapists
      WHERE kyc_status = 'verified' AND onboarding_complete = true
    `;
    console.log(
      `Seeded ${THERAPISTS.length} therapists (${count} pass the public visibility gate) ` +
        `and ${PROFILES.length} dev-persona profiles.\n` +
        `\n  These are NOT real clinicians. They exist only in this local database.\n` +
        `  Remove them with: npm run db:seed -- --clear\n`
    );
  }
} catch (error) {
  const detail =
    error instanceof AggregateError
      ? (error.errors ?? []).map((e) => e.message).join("; ")
      : error instanceof Error
        ? error.message
        : String(error);
  console.error(`Seeding failed: ${detail}`);
  if (String(detail).includes("ECONNREFUSED")) {
    console.error("\nNothing is listening. Run `docker compose up -d` first.\n");
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 }).catch(() => {});
}
