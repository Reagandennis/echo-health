/**
 * @jest-environment node
 */
import { postLoginTarget, safeRedirectPath } from "@/lib/auth/safe-redirect";

/**
 * The open-redirect guard on the auth callback.
 *
 * Worth unit-testing for the same reason `analytics-sanitize.test.ts` is: it is
 * a small predicate that fails SILENTLY and permissively if it is wrong. A
 * bypass here is not a stray redirect — `/auth/callback` authenticates the
 * visitor and then sends them wherever this function says, so a value that
 * escapes to another origin hands a freshly signed-in user to a look-alike
 * page, arriving from our own domain.
 *
 * The bypass cases below are the ones a `startsWith("/")` check waves through.
 */
describe("safeRedirectPath", () => {
  it("accepts a root-relative path and keeps its query string", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/onboarding?plan=couples")).toBe("/onboarding?plan=couples");
  });

  it("drops the fragment, which never reaches a server anyway", () => {
    expect(safeRedirectPath("/dashboard#section")).toBe("/dashboard");
  });

  it.each([
    ["an absolute URL", "https://evil.example/signin"],
    ["a scheme-relative URL", "//evil.example/signin"],
    ["a backslash-relative URL", "/\\evil.example/signin"],
    ["a backslash pair", "\\\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["a bare path with no leading slash", "dashboard"],
    ["an embedded newline", "/dashboard\nSet-Cookie: x=1"],
    ["an embedded carriage return", "/dashboard\r\nLocation: https://evil.example"],
    ["a tabbed authority", "/\thttps://evil.example"],
  ])("refuses %s", (_label, value) => {
    expect(safeRedirectPath(value)).toBe("/post-login");
  });

  it("refuses destinations that would loop or undo the sign-in", () => {
    expect(safeRedirectPath("/signin")).toBe("/post-login");
    expect(safeRedirectPath("/signup?plan=couples")).toBe("/post-login");
    expect(safeRedirectPath("/auth/signout")).toBe("/post-login");
    expect(safeRedirectPath("/auth/callback?code=abc")).toBe("/post-login");
  });

  it("allows /reset-password, which is where a recovery link must land", () => {
    expect(safeRedirectPath("/reset-password")).toBe("/reset-password");
  });

  it("falls back for absent values, and honours an empty fallback", () => {
    expect(safeRedirectPath(null)).toBe("/post-login");
    expect(safeRedirectPath(undefined)).toBe("/post-login");
    expect(safeRedirectPath("")).toBe("/post-login");
    expect(safeRedirectPath("//evil.example", "")).toBe("");
  });
});

describe("postLoginTarget", () => {
  it("carries a plan through, because /signup?plan=couples must reach /onboarding", () => {
    expect(postLoginTarget("?plan=couples")).toBe("/post-login?plan=couples");
  });

  it("carries a validated deep link through as ?next=", () => {
    expect(postLoginTarget("?next=%2Fdashboard%2Fsessions")).toBe(
      "/post-login?next=%2Fdashboard%2Fsessions"
    );
  });

  it("accepts returnTo as the Auth0-era alias for next", () => {
    expect(postLoginTarget("?returnTo=%2Ftherapist")).toBe("/post-login?next=%2Ftherapist");
  });

  it("silently drops a hostile next rather than forwarding it", () => {
    expect(postLoginTarget("?next=https%3A%2F%2Fevil.example")).toBe("/post-login");
    expect(postLoginTarget("?plan=couples&next=%2F%2Fevil.example")).toBe(
      "/post-login?plan=couples"
    );
  });

  it("returns the bare path when there is nothing to carry", () => {
    expect(postLoginTarget("")).toBe("/post-login");
  });
});
