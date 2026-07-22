import {
  scrubIdentifiers,
  scrubUrl,
  sanitizeProperties,
} from "@/lib/analytics/sanitize";

/**
 * These cases are drawn from data that was actually captured in production, not
 * invented: `/admin/therapists/<uuid>/credentials` appeared 10 times in the
 * project's first month. The clinical routes below are the same shape and are
 * what this module exists to keep out.
 */
describe("scrubUrl", () => {
  it("strips record uuids from a real captured admin URL", () => {
    expect(
      scrubUrl(
        "https://echopsychology.com/admin/therapists/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1/credentials"
      )
    ).toBe("https://echopsychology.com/admin/therapists/:id/credentials");
  });

  it("strips patient and session identifiers from clinical routes", () => {
    expect(
      scrubUrl("https://echopsychology.com/therapist/clients/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1")
    ).toBe("https://echopsychology.com/therapist/clients/:id");

    expect(
      scrubUrl("https://echopsychology.com/dashboard/sessions/11111111-2222-3333-4444-555555555555")
    ).toBe("https://echopsychology.com/dashboard/sessions/:id");
  });

  it("strips Auth0 subject ids, literal and url-encoded", () => {
    expect(scrubIdentifiers("auth0|abc123XYZ")).toBe(":sub");
    expect(scrubIdentifiers("google-oauth2%7C106952955461332538312")).toBe(":sub");
  });

  it("drops query params that are not on the attribution allowlist", () => {
    const out = scrubUrl(
      "https://echopsychology.com/signup?utm_source=google&email=someone@example.com&token=abc"
    );
    expect(out).toContain("utm_source=google");
    expect(out).not.toContain("someone@example.com");
    expect(out).not.toContain("token=abc");
  });

  it("keeps the plan param, which drives the post-login redirect", () => {
    expect(scrubUrl("https://echopsychology.com/post-login?plan=couples")).toContain(
      "plan=couples"
    );
  });

  it("handles bare pathnames, which is what $pathname carries", () => {
    expect(scrubUrl("/therapist/clients/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1")).toBe(
      "/therapist/clients/:id"
    );
  });

  it("drops the URL fragment", () => {
    expect(scrubUrl("https://echopsychology.com/guides#anchor")).toBe(
      "https://echopsychology.com/guides"
    );
  });

  it("leaves clean marketing URLs untouched apart from a trailing slash", () => {
    expect(scrubUrl("https://echopsychology.com/pricing")).toBe(
      "https://echopsychology.com/pricing"
    );
  });

  it("does not throw on empty or malformed input", () => {
    expect(scrubUrl("")).toBe("");
    expect(() => scrubUrl("not a url at all")).not.toThrow();
  });
});

describe("scrubIdentifiers", () => {
  it("removes bare email addresses", () => {
    expect(scrubIdentifiers("contact renoch@ladyaskari.com now")).toBe("contact :email now");
  });

  it("removes long opaque tokens", () => {
    expect(scrubIdentifiers("ref_01HZXKJ8N4QWERTYUIOPASDFGH12345")).toBe(":token");
  });
});

describe("sanitizeProperties", () => {
  it("scrubs every URL-bearing property posthog attaches", () => {
    const out = sanitizeProperties({
      $current_url: "https://echopsychology.com/therapist/clients/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1",
      $pathname: "/therapist/clients/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1",
      $referrer: "https://echopsychology.com/admin/therapists/a58b5f9b-ba3a-4e32-a2b4-c51211763fc1/credentials",
    });

    expect(out.$current_url).toBe("https://echopsychology.com/therapist/clients/:id");
    expect(out.$pathname).toBe("/therapist/clients/:id");
    expect(out.$referrer).toBe("https://echopsychology.com/admin/therapists/:id/credentials");
  });

  it("drops autocaptured element text, which on clinical screens is a client name or note", () => {
    const out = sanitizeProperties({
      $el_text: "Jane Doe — panic attacks, session 4",
      $elements: [{ tag_name: "div", text: "Jane Doe", attr__class: "client-row" }],
    });

    expect(out.$el_text).toBeUndefined();
    expect(out.$elements).toEqual([{ tag_name: "div", attr__class: "client-row" }]);
  });

  it("leaves non-URL, non-text properties alone", () => {
    const out = sanitizeProperties({ role: "therapist", seconds_to_connect: 4 });
    expect(out).toMatchObject({ role: "therapist", seconds_to_connect: 4 });
  });

  it("does not mutate the object it was given", () => {
    const input = { $el_text: "secret", $current_url: "https://echopsychology.com/x" };
    sanitizeProperties(input);
    expect(input.$el_text).toBe("secret");
  });
});
