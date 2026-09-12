import { and, desc, eq, sql } from "drizzle-orm";
import { therapists } from "@/lib/db/schema";
import { withAnonymous } from "@/lib/db/session";

/**
 * The public therapist directory.
 *
 * `therapists_select` is `USING (true)` in migration 0001 — the table is
 * deliberately world-readable, and AGENTS.md says why: visitors browse it
 * before signing in. Until now nothing used that: the home page rendered three
 * invented clinicians over stock photographs, and its "browse all" button
 * pointed at an anchor because, per the comment it carried, "browsing the full
 * roster requires an account". It does not.
 *
 * Reads run under `withAnonymous`, which sets no identity — correct here, and
 * the one place in the app where it is correct for a domain table.
 */

export interface DirectoryTherapist {
  readonly id: string;
  readonly name: string;
  readonly bio: string;
  readonly avatarUrl: string | null;
  readonly experience: number;
  readonly specialties: readonly string[];
  readonly timezone: string;
  readonly sessionDurationMinutes: number;
}

/**
 * The gate for appearing publicly. BOTH conditions, always.
 *
 * `kyc_status = 'verified'` is the licence check; `onboarding_complete` means
 * they have actually finished setting up a profile. A verified therapist with
 * a half-written bio on a public page is worse than one fewer card, and an
 * unverified one on a public page is a claim we cannot stand behind.
 *
 * Expressed once, here, so the directory and the profile route cannot
 * disagree about it — a profile page that renders someone the directory hides
 * is a leak with a URL.
 */
const publiclyVisible = and(
  eq(therapists.kycStatus, "verified"),
  eq(therapists.onboardingComplete, true)
);

/**
 * Columns are listed explicitly rather than selecting the row.
 *
 * `therapists` carries `license_number`, `license_url`, `kyc_review_note` and
 * the reviewing admin's id, and RLS does not filter columns — a `SELECT *`
 * here would pull an applicant's licence number and the internal note written
 * about their application into a public page's props, where it would sit in
 * the server-rendered HTML whether or not anything rendered it.
 */
const publicColumns = {
  id: therapists.id,
  name: therapists.name,
  bio: therapists.bio,
  avatarUrl: therapists.avatarUrl,
  experience: therapists.experience,
  specialties: therapists.specialties,
  timezone: therapists.timezone,
  sessionDurationMinutes: therapists.sessionDurationMinutes,
};

/**
 * Every read below degrades to "nobody is listed" instead of throwing.
 *
 * These queries run in three places that all fail badly on an exception:
 * `generateStaticParams` for `/therapists/[id]`, the ISR render of
 * `/therapists`, and the home page's therapist strip.
 *
 * With the error propagating, an unreachable database does not produce a
 * degraded directory — it fails `next build` outright ("Failed to collect page
 * data for /therapists/[id]"), so a momentary database blip during a deploy
 * takes down the deploy of an otherwise entirely static marketing site. At
 * request time it is a 500 on the most-linked page on the site.
 *
 * The honest empty state already exists on `/therapists`, and the home page
 * omits its strip when the list is empty, so an empty result is a page that
 * still works. `revalidate = 300` means the real roster reappears within five
 * minutes of the database coming back, with no deploy.
 *
 * It is logged at `error` rather than swallowed: this must be loud in the
 * server logs, because "the directory is empty" and "the directory is broken"
 * look identical from the outside and only one of them needs a person.
 */
async function safely<T>(what: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[directory] ${what} failed; serving an empty directory.`, error);
    return fallback;
  }
}

function toDirectory(row: {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  experience: number;
  specialties: string[] | null;
  timezone: string;
  sessionDurationMinutes: number;
}): DirectoryTherapist {
  return { ...row, specialties: row.specialties ?? [] };
}

/** Every publicly listed therapist, most experienced first. */
export async function listPublicTherapists(): Promise<DirectoryTherapist[]> {
  return safely(
    "listPublicTherapists",
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(publiclyVisible)
          .orderBy(desc(therapists.experience), therapists.name)
      );
      return rows.map(toDirectory);
    },
    []
  );
}

/**
 * A handful for the home page.
 *
 * Random rather than "top rated": `therapists.rating` is nullable and nothing
 * in the product writes to it yet, so ordering by it would silently order by
 * "whoever happens to have a value", which is not a ranking anybody agreed to.
 * Rotating the sample also means new clinicians get seen.
 */
export async function sampleTherapists(limit = 3): Promise<DirectoryTherapist[]> {
  return safely(
    "sampleTherapists",
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(publiclyVisible)
          .orderBy(sql`random()`)
          .limit(limit)
      );
      return rows.map(toDirectory);
    },
    []
  );
}

/** One therapist, or null. Applies the same visibility gate as the listing. */
export async function getPublicTherapist(id: string): Promise<DirectoryTherapist | null> {
  /* A malformed id would make Postgres raise on the uuid cast rather than
     return no rows, turning a 404 into a 500 for anyone who edits the URL. */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }

  return safely(
    `getPublicTherapist(${id})`,
    async () => {
      const rows = await withAnonymous((tx) =>
        tx
          .select(publicColumns)
          .from(therapists)
          .where(and(publiclyVisible, eq(therapists.id, id)))
          .limit(1)
      );
      return rows[0] ? toDirectory(rows[0]) : null;
    },
    /* `null` here renders the 404, not a 500. A profile that cannot be read is
       indistinguishable from one that does not exist, from the visitor's side
       — and `notFound()` is the response that does not leak a stack trace. */
    null
  );
}

/** The specialty facets actually present in the directory, for the filter row. */
export function collectSpecialties(list: readonly DirectoryTherapist[]): string[] {
  const seen = new Set<string>();
  for (const t of list) for (const s of t.specialties) seen.add(s);
  return [...seen].sort((a, b) => a.localeCompare(b));
}
