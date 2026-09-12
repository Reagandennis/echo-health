import { MARKETS, type Market } from "./markets";

/**
 * ── What a therapist must prove, per jurisdiction ──────────────────────────
 *
 * ## The problem this exists to fix
 *
 * Echo's clinicians were all licensed in Kenya, and every client — in thirteen
 * countries — got one of them. The country pages disclose that honestly, but
 * disclosure is not the same as being appropriate: a client in the UK or the
 * US is receiving therapy from someone their own regulator has never assessed,
 * with no local complaints route and no letter any local insurer will accept.
 *
 * So a therapist can now hold a licence **per jurisdiction**, verified against
 * that jurisdiction's requirements, and the matching and directory can prefer
 * a clinician licensed where the client actually is.
 *
 * ## ⚠️ What is asserted here, and what is deliberately not
 *
 * Naming the wrong regulator is worse than naming none: an applicant would
 * upload the wrong document, a reviewer would approve against a body with no
 * authority, and the platform would be claiming a verification it had not
 * performed. This codebase already has a rule for exactly this shape of
 * problem — see the crisis-helpline note in `lib/constants.ts`: *"Publishing
 * an unverified emergency number is the specific failure this rewrite exists
 * to fix."* Same discipline applies.
 *
 * So each jurisdiction carries a `verification` mode:
 *
 *   - `"named-regulator"` — I can name the body with reasonable confidence and
 *     a reviewer should check the applicant against it.
 *   - `"sub-national"` — regulation is at state/province level, NOT national.
 *     The US and Canada are like this and treating them as one licence is a
 *     category error that would let a therapist licensed in one state be
 *     presented as licensed countrywide.
 *   - `"case-by-case"` — I do NOT reliably know the statutory position. The
 *     requirement is documentary evidence of the right to practise, reviewed
 *     by a person, and the reviewer UI says so rather than pretending.
 *
 * **`needsLocalConfirmation` marks every entry a qualified local adviser must
 * confirm before Echo lists a clinician in that jurisdiction.** It is true for
 * most of them, on purpose. Do not flip one to false because it looks
 * plausible; flip it when someone competent has actually checked.
 */

export type VerificationMode = "named-regulator" | "sub-national" | "case-by-case";

export interface JurisdictionRequirement {
  /** Matches a `MARKETS` slug in `lib/markets.ts`. */
  readonly slug: string;
  readonly country: string;
  readonly verification: VerificationMode;
  /**
   * Bodies a reviewer should check against. Empty for `case-by-case` — an
   * empty list is the honest representation of "we do not know yet", and the
   * reviewer UI renders it as such rather than as "no requirements".
   */
  readonly regulators: readonly string[];
  /** Public register a reviewer can search, where one is known. */
  readonly registerUrl?: string;
  /** Shown to the applicant. Plain language, no legal advice. */
  readonly applicantGuidance: string;
  /** Shown to the reviewer. What "verified" must mean before they click it. */
  readonly reviewerGuidance: string;
  /**
   * True until a qualified local adviser has confirmed this entry. Gates
   * whether Echo will list a clinician as licensed here — see
   * `canListInJurisdiction`.
   */
  readonly needsLocalConfirmation: boolean;
}

/**
 * Kenya is the only entry with `needsLocalConfirmation: false`, because it is
 * the jurisdiction Echo actually operates in and the one whose credentialing
 * process the team has run.
 *
 * Everything else is a starting point for someone who knows that country's
 * rules. The `case-by-case` entries are not laziness — they are the difference
 * between "we check against the register" and "we look at the documents and
 * use judgement", and a reviewer needs to know which they are doing.
 */
export const JURISDICTION_REQUIREMENTS: readonly JurisdictionRequirement[] = [
  {
    slug: "kenya",
    country: "Kenya",
    verification: "named-regulator",
    regulators: ["Counsellors and Psychologists Board"],
    applicantGuidance:
      "Upload your current practising certificate and your registration with the " +
      "Counsellors and Psychologists Board, plus a government ID. Your registration " +
      "number must match the name on your ID.",
    reviewerGuidance:
      "Check the registration number against the Board's register and confirm the " +
      "practising certificate is current, not merely issued. A lapsed certificate is " +
      "a rejection, not a query.",
    needsLocalConfirmation: false,
  },
  {
    slug: "united-kingdom",
    country: "the United Kingdom",
    verification: "named-regulator",
    /*
     * Worth understanding before reviewing a UK applicant: "psychologist" is
     * only partly a protected title. Practitioner psychologists (clinical,
     * counselling, etc.) are statutorily regulated by the HCPC. Counsellors
     * and psychotherapists are NOT statutorily regulated in the UK — BACP and
     * UKCP are professional bodies holding accredited registers, which is a
     * real and checkable credential but not a statutory licence.
     *
     * A reviewer who treats BACP membership as equivalent to HCPC registration
     * is not making a small error; they are describing the applicant's
     * standing incorrectly to every UK client.
     */
    regulators: [
      "Health and Care Professions Council (HCPC) — statutory, practitioner psychologists",
      "BACP — accredited register, counsellors and psychotherapists (not statutory)",
      "UKCP — accredited register, psychotherapists (not statutory)",
    ],
    registerUrl: "https://www.hcpc-uk.org/check-the-register/",
    applicantGuidance:
      "If you are a practitioner psychologist, give your HCPC registration number. If " +
      "you are a counsellor or psychotherapist, give your BACP or UKCP membership " +
      "number — note that these are accredited registers rather than statutory " +
      "regulation, and we will describe your standing accurately to clients.",
    reviewerGuidance:
      "HCPC numbers are checkable on the public register. BACP/UKCP membership is a " +
      "different and weaker claim than statutory registration — record which one it is " +
      "and do not describe a BACP member as HCPC-registered.",
    needsLocalConfirmation: true,
  },
  {
    slug: "united-states",
    country: "the United States",
    verification: "sub-national",
    /*
     * There is no national licence. Licensure is per state, by a state board,
     * and practising across a state line generally requires licensure in the
     * client's state — which is why this is `sub-national` rather than a US
     * entry with a number in it.
     *
     * Consequence for this product: "licensed in the United States" is not a
     * meaningful claim and must never appear. A therapist licensed in
     * California is licensed in California. `requiresSubdivision` below is why
     * the licence record carries a `subdivision` column.
     */
    regulators: [
      "State licensing boards — one per state, no national equivalent",
      "Common titles: licensed psychologist, LPC, LMFT, LCSW, LMHC",
    ],
    applicantGuidance:
      "US licences are issued by individual states, so tell us the state and give the " +
      "licence number the board issued. A licence in one state does not let you see " +
      "clients in another; we will list you only for the states you are licensed in.",
    reviewerGuidance:
      "Verify against the named state's board, not a national directory — there is no " +
      "national register. Record the state. Never approve a licence as covering the " +
      "United States generally.",
    needsLocalConfirmation: true,
  },
  {
    slug: "canada",
    country: "Canada",
    verification: "sub-national",
    /*
     * Provincial, like the US. Ontario's College of Registered Psychotherapists
     * (CRPO) is the one I can name with confidence; the others vary by province
     * and by title, hence `needsLocalConfirmation`.
     */
    regulators: [
      "Provincial regulatory colleges — one per province, no national equivalent",
      "Ontario: College of Registered Psychotherapists of Ontario (CRPO)",
    ],
    applicantGuidance:
      "Canadian regulation is provincial. Tell us the province and give the number your " +
      "provincial college issued.",
    reviewerGuidance:
      "Verify with the named province's college. Record the province. Do not approve a " +
      "licence as covering Canada generally.",
    needsLocalConfirmation: true,
  },
  {
    slug: "south-africa",
    country: "South Africa",
    verification: "named-regulator",
    regulators: ["Health Professions Council of South Africa (HPCSA)"],
    applicantGuidance:
      "Give your HPCSA registration number and category, with your current annual " +
      "registration receipt.",
    reviewerGuidance:
      "Check the HPCSA register and confirm the registration is current for the year. " +
      "Confirm the category covers independent practice.",
    needsLocalConfirmation: true,
  },
  /*
   * ── The ones I will not guess at ────────────────────────────────────────
   *
   * For the remaining markets I do not reliably know whether psychotherapy is
   * statutorily regulated, by which body, or under what title. Rather than
   * name a plausible-sounding council, each is `case-by-case`: the applicant
   * supplies documentary evidence of their right to practise and a person
   * reviews it, and both the applicant and the reviewer are told that is what
   * is happening.
   *
   * This is the same discipline as the crisis list: a named regulator that
   * turns out not to regulate anything is worse than an honest "reviewed by a
   * human", because it manufactures false confidence in a credential.
   */
  ...(["uganda", "tanzania", "rwanda", "nigeria", "ghana", "uae", "saudi-arabia", "qatar"] as const).map(
    (slug): JurisdictionRequirement => {
      const market = MARKETS.find((m) => m.slug === slug)!;
      return {
        slug,
        country: market.country,
        verification: "case-by-case",
        regulators: [],
        applicantGuidance:
          `Tell us how you are authorised to practise in ${market.country} and upload the ` +
          `documents that evidence it — a registration, a licence, or the equivalent. We ` +
          `review these individually rather than against a checklist, so include anything ` +
          `you think a reviewer would want to see.`,
        reviewerGuidance:
          `Echo has not established the statutory position in ${market.country}. Do NOT ` +
          `approve this as regulator-verified. Read the documents, record what they ` +
          `actually evidence, and escalate if you cannot tell. Getting a local adviser to ` +
          `confirm the requirements for this country is the real fix.`,
        needsLocalConfirmation: true,
      };
    }
  ),
];

export function requirementFor(slug: string): JurisdictionRequirement | undefined {
  return JURISDICTION_REQUIREMENTS.find((j) => j.slug === slug);
}

/** True where a licence is issued below national level (US states, CA provinces). */
export function requiresSubdivision(slug: string): boolean {
  return requirementFor(slug)?.verification === "sub-national";
}

/**
 * Whether Echo will publicly list a clinician as licensed in this jurisdiction.
 *
 * Gated on `needsLocalConfirmation` being resolved, because the alternative is
 * telling a UK client "your therapist is HCPC-registered" on the strength of a
 * requirement list nobody qualified has checked. Until someone signs off on a
 * jurisdiction, a licence can be recorded and reviewed but not advertised — the
 * therapist is still listed, just not as locally licensed.
 *
 * Deliberately a function rather than a boolean column, so that resolving a
 * jurisdiction is a one-line change here rather than a data migration.
 */
export function canListInJurisdiction(slug: string): boolean {
  const requirement = requirementFor(slug);
  return Boolean(requirement) && !requirement!.needsLocalConfirmation;
}

/** Jurisdictions an applicant may claim, in the order the UI should offer them. */
export function selectableJurisdictions(): readonly JurisdictionRequirement[] {
  /* Kenya first: it is where most applicants are and the only resolved entry. */
  return [...JURISDICTION_REQUIREMENTS].sort((a, b) =>
    a.slug === "kenya" ? -1 : b.slug === "kenya" ? 1 : a.country.localeCompare(b.country)
  );
}

/**
 * What a client in `market` should be told about a practitioner's licensing.
 *
 * One function, so the directory, the profile page, the country pages and the
 * matching explanation cannot drift into telling four different stories about
 * the same fact — which is exactly what happened when "licensed in Kenya" was
 * hardcoded in nine places.
 *
 * ## ⚠️ An empty list is NOT Kenya
 *
 * This function had `"Licensed in Kenya."` as its fallback for a practitioner
 * with no listable licence, in both branches. That was written when every
 * clinician was Kenyan-licensed and the licence table did not exist, so
 * "nothing on file" really did mean "the Kenyan default".
 *
 * After migration 0018 backfilled an explicit `kenya` row for every verified
 * therapist, an empty list inverted its meaning: it now describes someone with
 * **no verified licence anywhere**. The fallback therefore asserted a specific
 * Kenyan credential on behalf of a person who might hold none — a fabricated
 * professional qualification attached to a named individual, which is the same
 * class of claim as the invented clinicians that once filled the home page.
 *
 * It reached no page before it was found (nothing called this function yet),
 * which is luck rather than design. `locallyLicensed` stays `false` throughout
 * the unlicensed path, so no caller can read the summary as a credential.
 */
export function describeLicensingForClient(
  clientMarket: Market | undefined,
  therapistJurisdictions: readonly string[]
): { readonly locallyLicensed: boolean; readonly summary: string } {
  const listable = therapistJurisdictions.filter(canListInJurisdiction);
  const names = () =>
    listable.map((s) => requirementFor(s)?.country ?? s).join(", ");

  /*
   * No listable licence: say so plainly and name what it costs the reader.
   * `lib/practitioners.ts` is what turns this into the right noun on a page;
   * this function's job is to never imply a licence that is not there.
   */
  if (listable.length === 0) {
    return {
      locallyLicensed: false,
      summary: clientMarket
        ? `Not licensed as a therapist in ${clientMarket.country}, or anywhere we can ` +
          `confirm. Sessions with them are non-clinical wellness coaching — not ` +
          `therapy, and not a substitute for it.`
        : "Not licensed as a therapist in any jurisdiction we can confirm. Sessions " +
          "with them are non-clinical wellness coaching — not therapy, and not a " +
          "substitute for it.",
    };
  }

  if (!clientMarket) {
    return { locallyLicensed: false, summary: `Licensed in ${names()}.` };
  }

  if (listable.includes(clientMarket.slug)) {
    return {
      locallyLicensed: true,
      summary: `Licensed to practise in ${clientMarket.country}, where you are.`,
    };
  }

  return {
    locallyLicensed: false,
    summary:
      `Licensed in ${names()} — not in ${clientMarket.country}. That matters if you ` +
      `need a diagnosis or a letter a local insurer, employer, school or court will accept.`,
  };
}
