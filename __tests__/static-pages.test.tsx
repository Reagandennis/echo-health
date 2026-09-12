import { render, screen } from "@testing-library/react";
import GuidesPage from "@/app/(marketing)/guides/page";
import PrivacyPolicyPage, { metadata } from "@/app/(marketing)/privacy/page";

describe("static public pages", () => {
  it("renders the guides library content", () => {
    render(<GuidesPage />);

    expect(screen.getByRole("heading", { name: /Mental Health Guides/i })).toBeInTheDocument();
    expect(screen.getByText("Understanding and Managing Anxiety")).toBeInTheDocument();
    expect(screen.getByText("An Introduction to CBT")).toBeInTheDocument();
    /*
     * Was `getByPlaceholderText("Your email address")`.
     *
     * That asserted the presence of a newsletter sign-up whose email field and
     * "Subscribe" button were not inside a `<form>` and had no handler — every
     * address typed into it was silently dropped, and there is no mailing-list
     * endpoint in this app to wire it to. The test was pinning a broken
     * control in place. It now asserts the CTA that replaced it.
     */
    expect(screen.getByRole("link", { name: /Find your therapist/i })).toBeInTheDocument();
  });

  it("renders the privacy policy with compliance metadata", () => {
    render(<PrivacyPolicyPage />);

    /*
     * Sentence case, and the date is now a `<dl>` rather than a run-on string.
     *
     * The heading was asserted as "Privacy Policy" and the date as the literal
     * "Last Updated: May 1, 2026". Both were rewritten when the document moved
     * onto the shared `LegalDoc` shell: headings across the site are sentence
     * case ("Terms of service", "Cookie settings", "Find a therapist"), and the
     * dates became a definition list so "Effective" and "Last updated" are
     * separately labelled rather than concatenated into one sentence.
     */
    expect(screen.getByRole("heading", { name: "Privacy policy" })).toBeInTheDocument();
    expect(screen.getByText("Last updated")).toBeInTheDocument();
    /*
     * Was `getByText(/HIPAA Compliant/)` plus a table-of-contents link to a
     * `#hipaa` section.
     *
     * Both assertions were pinning false statements in place. HIPAA is a United
     * States statute with no application to a service delivered from Kenya, so
     * the badge claimed a compliance status that cannot exist here, and the
     * section it linked to told Kenyan users to complain to a US federal
     * agency. The rest of the site had already been swept for HIPAA claims;
     * this test is part of why the privacy policy was not.
     *
     * They now assert the honest replacements: a badge describing the legal
     * regime that actually governs the service, and the section stating the
     * data-subject rights it grants.
     */
    /*
     * The assurance-chip row is gone with the rewrite — it described the legal
     * regime in three words above a document that now spends thirteen sections
     * on it, and a chip is a weaker place to make that claim than a governed-by
     * sentence in the opening. So this asserts the sentence instead.
     */
    /* `getAllByText` throughout this block: several of these phrases appear
       both in the table of contents and in the section itself, or in the
       opening summary and again in the section that expands it. Asserting
       uniqueness would be asserting something about the layout, not about the
       disclosure being present. */
    expect(screen.getAllByText(/Data Protection Act 2019/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /Your rights, and how they actually work here/i })
    ).toHaveAttribute("href", "#rights");

    /*
     * Guards against the US text creeping back in wholesale. Kept, and worth
     * keeping: it is the assertion that would have caught the original policy
     * claiming covered-entity status under a statute that does not apply.
     */
    expect(screen.queryByText(/HIPAA/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CCPA/)).not.toBeInTheDocument();

    /*
     * The three disclosures this document exists to make, and which nothing
     * else in the suite covers: that messages are scanned, that the processor
     * receiving your IP is named, and that erasure has real limits. Each was
     * absent from the previous version.
     */
    expect(screen.getAllByText(/Automated safety scanning/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ipapi\.co/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Clinical notes/).length).toBeGreaterThan(0);
  });

  it("exports privacy page metadata", () => {
    expect(metadata.title).toBe("Privacy policy");
    /* The old description claimed compliance with HIPAA, GDPR and CCPA. */
    expect(metadata.description).toContain("Data Protection Act 2019");
    expect(metadata.description).not.toMatch(/HIPAA|CCPA/);
  });
});
