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

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText("Last Updated: May 1, 2026")).toBeInTheDocument();
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
    expect(screen.getByText(/Kenya DPA 2019 aligned/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Your Rights Under the Data Protection Act/i })
    ).toHaveAttribute("href", "#your-rights");
    // Guard against the US text creeping back in wholesale.
    expect(screen.queryByText(/HIPAA/)).not.toBeInTheDocument();
  });

  it("exports privacy page metadata", () => {
    expect(metadata.title).toBe("Privacy Policy");
    expect(metadata.description).toContain("Echo Health's comprehensive Privacy Policy");
  });
});
