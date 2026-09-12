/**
 * @jest-environment node
 *
 * The licensed-therapist / wellness-coach distinction.
 *
 * `lib/practitioners.ts` exists because the distinction is only worth anything
 * if it is enforced rather than asserted — its own header says so, and `/terms`
 * §2 and §3 now make commitments that depend on it. For a while the module was
 * imported by nothing at all: the terms described three gates and the code ran
 * none of them. These tests are about the two properties that have consequences
 * if they rot, not about the shape of the strings.
 */
import { QUESTIONS } from "@/lib/intake";
import {
  collectiveTitle,
  displayTitle,
  offeringFor,
  permittedScope,
  practitionerTypeFor,
  requiresLicensedPractitioner,
} from "@/lib/practitioners";

describe("practitionerTypeFor", () => {
  it("treats a practitioner with no advertisable licence as a coach", () => {
    // The safe direction. Understating a real clinician costs a booking;
    // the opposite tells someone their coach is a therapist.
    expect(practitionerTypeFor([])).toBe("wellness_coach");
  });

  it("treats a practitioner with an advertisable licence as a therapist", () => {
    expect(practitionerTypeFor(["kenya"])).toBe("licensed_therapist");
  });

  it("does not care which jurisdiction, only that there is one", () => {
    /*
     * Filtering to verified licences in listable jurisdictions happens before
     * this function — in SQL and then in `lib/directory.ts`. Re-deriving that
     * here would put the rule in two places, and the copy that drifts is
     * always the one further from the data.
     */
    expect(practitionerTypeFor(["united-kingdom", "kenya"])).toBe("licensed_therapist");
  });
});

describe("displayTitle", () => {
  it("never calls a coach a therapist", () => {
    expect(displayTitle("wellness_coach")).not.toMatch(/therapist/i);
    expect(displayTitle("wellness_coach", true)).not.toMatch(/therapist/i);
  });

  it("gives both types a plural that is not the singular", () => {
    for (const type of ["licensed_therapist", "wellness_coach"] as const) {
      expect(displayTitle(type, true)).not.toBe(displayTitle(type));
    }
  });
});

describe("collectiveTitle", () => {
  it("uses the vague word only when the list is genuinely mixed", () => {
    expect(collectiveTitle(["licensed_therapist", "wellness_coach"])).toBe("practitioners");
    // Saying "practitioners" about an all-therapist roster makes an accurate
    // page read as an evasive one.
    expect(collectiveTitle(["licensed_therapist"])).toBe("therapists");
    expect(collectiveTitle(["wellness_coach"])).toBe("wellness coaches");
  });

  it("never says therapists about a list containing a coach", () => {
    expect(collectiveTitle(["licensed_therapist", "wellness_coach"])).not.toBe("therapists");
  });
});

describe("offeringFor", () => {
  it("reports therapy for a licensed therapist and coaching for a coach", () => {
    expect(offeringFor("licensed_therapist").offering).toBe("therapy");
    expect(offeringFor("wellness_coach").offering).toBe("coaching");
  });

  it("does not describe a coach's sessions as a substitute for therapy", () => {
    expect(offeringFor("wellness_coach").reason).toMatch(/not a\s+substitute/i);
  });
});

describe("permittedScope", () => {
  it("forbids a coach from working with risk, and says so where a client reads it", () => {
    /*
     * The single most consequential line in the module. A coach is not
     * trained, supervised or insured to hold someone who is suicidal, and the
     * profile page renders `mayNot` at the same size as `may` because of it.
     */
    const coach = permittedScope("wellness_coach");
    expect(coach.mayNot.join(" ")).toMatch(/harming themselves/i);
    expect(coach.mayNot.join(" ")).toMatch(/diagnos/i);
  });

  it("forbids a coach being described as a therapist", () => {
    expect(permittedScope("wellness_coach").mayNot.join(" ")).toMatch(
      /describe themselves.*therapist|as a therapist/i
    );
  });

  it("does not claim a therapist can prescribe or handle a crisis", () => {
    const therapist = permittedScope("licensed_therapist");
    expect(therapist.mayNot.join(" ")).toMatch(/medication/i);
    expect(therapist.mayNot.join(" ")).toMatch(/emergency|crisis/i);
  });
});

describe("requiresLicensedPractitioner — the safety gate", () => {
  /**
   * Every `focus` value the intake can actually produce.
   *
   * Read from `QUESTIONS` rather than typed out, because the whole point of
   * the case below is to notice when these two files stop agreeing.
   */
  const intakeFocusValues = QUESTIONS.find((q) => q.id === "focus")!.choices.map(
    (c) => c.value
  );

  it("classifies every focus value the intake can produce", () => {
    /*
     * ## The drift this exists to catch
     *
     * `requiresLicensedPractitioner` has an explicit clinical list and an
     * explicit non-clinical list, and anything in neither falls through to
     * "require a clinician". That fallback is the safe direction, but it is a
     * backstop, not a decision — if someone adds a choice to `lib/intake.ts`
     * and never classifies it here, every client who picks it is silently
     * routed to a licensed therapist whether or not that is right, and nobody
     * finds out because nothing fails.
     *
     * So this asserts the classification is DELIBERATE for each value: the
     * explanation returned for a clinical answer differs from the one the
     * unclassified fallback returns.
     */
    const unclassifiedWording = /not certain coaching is the right fit/i;

    for (const value of intakeFocusValues) {
      const result = requiresLicensedPractitioner({ focus: [value] });
      expect(result.because).not.toMatch(unclassifiedWording);
    }
  });

  it("requires a clinician for clinical presentations", () => {
    for (const value of ["depression", "trauma", "anxiety", "grief"]) {
      expect(requiresLicensedPractitioner({ focus: [value] }).required).toBe(true);
    }
  });

  it("allows coaching for ordinary coaching territory", () => {
    for (const value of ["work", "stress", "relationships", "unsure"]) {
      expect(requiresLicensedPractitioner({ focus: [value] }).required).toBe(false);
    }
  });

  it("requires a clinician when a clinical answer is mixed with a coaching one", () => {
    // The dangerous combination: a coach could otherwise be justified by the
    // presence of any single non-clinical selection.
    expect(
      requiresLicensedPractitioner({ focus: ["work", "trauma"] }).required
    ).toBe(true);
  });

  it("requires a clinician for someone already in therapy", () => {
    expect(
      requiresLicensedPractitioner({ focus: ["work"], experience: ["current"] }).required
    ).toBe(true);
  });

  it("fails towards the clinician for an answer nobody has classified", () => {
    expect(
      requiresLicensedPractitioner({ focus: ["something-added-later"] }).required
    ).toBe(true);
  });

  it("does not require a clinician when nothing was answered", () => {
    /*
     * An empty intake is the person who skipped every optional question. They
     * are not a clinical presentation and must not be treated as one — routing
     * everybody to the scarce resource is how the gate gets removed.
     */
    expect(requiresLicensedPractitioner({}).required).toBe(false);
  });
});
