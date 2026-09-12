import { MARKETS, type Market } from "./markets";
import { canListInJurisdiction, requirementFor } from "./licensing";

/**
 * ── Two kinds of practitioner, and why the distinction is load-bearing ─────
 *
 * Echo works with practitioners worldwide. In jurisdictions where Echo has a
 * locally licensed clinician, it can offer **therapy**. In jurisdictions where
 * it does not, the honest offering is **non-clinical wellness coaching** —
 * because "therapist", "psychotherapist" and "psychologist" are protected
 * titles in many places, and delivering regulated treatment without local
 * registration is in several of them a criminal offence rather than a
 * contractual risk.
 *
 * ## ⚠️ The label does not do the work. Read this before changing anything.
 *
 * The legal character of a service is determined by **what is actually
 * delivered**, not by the noun in the contract. Writing "coaching" in the
 * terms while the product describes the same sessions as therapy, matches
 * clients presenting with depression to a coach, or markets "treatment for
 * anxiety" in that country, does not create a defence. It creates a document
 * that proves the mislabelling was deliberate.
 *
 * So the distinction is only worth anything if it is enforced in three places,
 * and this module exists to make that enforceable rather than aspirational:
 *
 *   1. **Titling.** A coach is called a coach everywhere — directory, profile,
 *      booking, emails, marketing. `displayTitle()` is the only place that
 *      decides, so it cannot be "therapist" in one component and "coach" in
 *      another. Never hardcode a practitioner noun in a page.
 *
 *   2. **Scope.** A coach does not assess, diagnose or treat mental illness.
 *      `permittedScope()` states what each type may do, and the booking and
 *      matching paths must consult it.
 *
 *   3. **Matching.** A client whose intake indicates a clinical presentation
 *      must not be routed to a coach. `requiresLicensedPractitioner()` is that
 *      gate. This is the one with safety consequences, not just legal ones: a
 *      coach is not trained or insured to hold someone who is suicidal, and
 *      the platform sending them one is the single worst thing this design
 *      could do.
 *
 * If any of those three stops being true, the coaching route stops being
 * defensible and should be withdrawn rather than papered over.
 */

export type PractitionerType = "licensed_therapist" | "wellness_coach";

export interface PractitionerScope {
  readonly type: PractitionerType;
  /** The noun used in every client-facing surface. */
  readonly title: string;
  /** Plural, for headings and lists. */
  readonly titlePlural: string;
  /** What this practitioner may do. Shown to clients before they book. */
  readonly may: readonly string[];
  /** What they may not. Shown with equal prominence, not in a footnote. */
  readonly mayNot: readonly string[];
}

export const PRACTITIONER_SCOPES: Record<PractitionerType, PractitionerScope> = {
  licensed_therapist: {
    type: "licensed_therapist",
    title: "therapist",
    titlePlural: "therapists",
    may: [
      "Provide psychotherapy and counselling within their licence",
      "Work with mental-health conditions such as anxiety, depression and trauma",
      "Keep clinical notes as a professional record",
    ],
    mayNot: [
      "Prescribe or manage medication",
      "Provide a formal diagnosis or report for an insurer, employer, school or court outside the jurisdiction they are licensed in",
      "Provide emergency or crisis care",
    ],
  },
  wellness_coach: {
    type: "wellness_coach",
    title: "wellness coach",
    titlePlural: "wellness coaches",
    may: [
      "Support goal-setting, habits, stress management and life transitions",
      "Offer structured, non-clinical conversation and accountability",
      "Help you prepare for, or think about, seeking clinical care",
    ],
    /*
     * This list is the product boundary, not legal garnish. Each line is a
     * thing a coach must be prevented from doing by the product, not merely
     * asked not to do — see `requiresLicensedPractitioner` below.
     */
    mayNot: [
      "Provide therapy, psychotherapy or counselling for a mental-health condition",
      "Assess, diagnose or treat mental illness",
      "Work with anyone at risk of harming themselves or others",
      "Describe themselves, or be described by Echo, as a therapist, psychotherapist or psychologist",
      "Keep clinical records, or act as anyone's clinician",
    ],
  },
};

/**
 * The noun to use for a practitioner, everywhere.
 *
 * One function so the answer cannot differ between the directory card, the
 * profile page, the booking confirmation and the receipt. A coach described as
 * a "therapist" in one email is the whole problem this module exists to
 * prevent, and it is exactly the kind of drift that happens when nine
 * components each hardcode a word — as nine of them did with "licensed in
 * Kenya" before `describeLicensingForClient` centralised that.
 */
export function displayTitle(type: PractitionerType, plural = false): string {
  const scope = PRACTITIONER_SCOPES[type];
  return plural ? scope.titlePlural : scope.title;
}

export function permittedScope(type: PractitionerType): PractitionerScope {
  return PRACTITIONER_SCOPES[type];
}

/**
 * What Echo can offer in a market, given who it actually has there.
 *
 * `therapy` requires a practitioner Echo can list as locally licensed —
 * `canListInJurisdiction` gates that on a qualified adviser having confirmed
 * the jurisdiction's requirements, so an unconfirmed country cannot quietly
 * become a therapy market.
 *
 * Everywhere else the offering is coaching, and the copy for that market must
 * say coaching. This function is what the country pages and the intake funnel
 * should ask rather than assuming.
 */
export function offeringFor(market: Market): {
  readonly offering: "therapy" | "coaching";
  readonly reason: string;
} {
  if (canListInJurisdiction(market.slug)) {
    return {
      offering: "therapy",
      reason: `Echo has practitioners licensed to provide therapy in ${market.country}.`,
    };
  }

  const requirement = requirementFor(market.slug);
  return {
    offering: "coaching",
    reason: requirement
      ? `Echo does not yet have a practitioner licensed to provide therapy in ${market.country}, ` +
        `so what is offered there is non-clinical wellness coaching. ` +
        `We are working towards locally licensed therapists; until then, calling it ` +
        `therapy would be inaccurate and in some jurisdictions unlawful.`
      : `${market.country} is not a market Echo currently serves.`,
  };
}

/**
 * Whether this client's intake answers mean they need a licensed clinician.
 *
 * **The safety gate.** A wellness coach is not trained, supervised or insured
 * to work with mental illness or with risk, so a platform that routes such a
 * client to one has done something considerably worse than mislabel a service.
 *
 * The `focus` values come from `lib/intake.ts`. The clinical ones are listed
 * explicitly rather than inferred, because a default of "coaching is fine" for
 * an unrecognised answer is the wrong direction to fail: a new intake option
 * added later must land on the safe side until someone classifies it.
 *
 * Note what this does NOT do: it is not a risk assessment and not a triage
 * instrument. It is a coarse routing rule. `lib/clinical/risk.ts` is a
 * substring matcher and is deliberately not consulted here — a keyword scanner
 * deciding whether someone gets a clinician would be worse than this list.
 */
const CLINICAL_FOCUS = new Set([
  "depression",
  "trauma",
  "anxiety",
  "grief",
  "self-esteem",
  "sleep",
]);

/** Focus answers that are ordinary coaching territory. */
const NON_CLINICAL_FOCUS = new Set(["work", "stress", "relationships", "unsure"]);

export function requiresLicensedPractitioner(answers: {
  readonly focus?: readonly string[];
  readonly experience?: readonly string[];
}): { readonly required: boolean; readonly because: string } {
  const focus = answers.focus ?? [];

  const clinical = focus.filter((f) => CLINICAL_FOCUS.has(f));
  if (clinical.length > 0) {
    return {
      required: true,
      because:
        "What you said you want to work on is clinical territory, so you need a " +
        "licensed therapist rather than a coach.",
    };
  }

  /*
   * Already in therapy, or previously in it, points at a clinical history a
   * coach should not pick up mid-course.
   */
  if (answers.experience?.[0] === "current") {
    return {
      required: true,
      because:
        "You told us you are already seeing a therapist, so continuity of clinical " +
        "care matters more than a coaching relationship.",
    };
  }

  /*
   * Fail towards the clinician. An answer nobody has classified must not
   * default to coaching — a new intake option added without touching this file
   * would otherwise silently widen who a coach can be given.
   */
  const unclassified = focus.filter(
    (f) => !CLINICAL_FOCUS.has(f) && !NON_CLINICAL_FOCUS.has(f)
  );
  if (unclassified.length > 0) {
    return {
      required: true,
      because:
        "We are not certain coaching is the right fit for what you described, so we " +
        "will match you with a licensed therapist.",
    };
  }

  return {
    required: false,
    because:
      "What you described is something a wellness coach can help with, and one may be " +
      "available sooner.",
  };
}

/** Markets where Echo can currently offer therapy rather than coaching. */
export function therapyMarkets(): readonly Market[] {
  return MARKETS.filter((m) => offeringFor(m).offering === "therapy");
}
