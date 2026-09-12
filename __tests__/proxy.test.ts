/**
 * @jest-environment node
 */
import { NextResponse } from "next/server";

/**
 * Rewritten for Supabase Auth.
 *
 * This suite used to mock `@/lib/auth0`, which no longer exists. Every
 * behaviour it asserted still matters and is preserved below — the segment
 * boundaries especially, since a regression there is a route silently exempt
 * from the session gate. Three things changed in the port:
 *
 *  - The redirect target is `/signin?next=…` rather than `/auth/login?returnTo=…`.
 *    Supabase has no SDK-served routes, so sign-in is an ordinary page.
 *  - The `/auth/*` short-circuit is gone for the same reason. `/auth/callback`
 *    and `/auth/signout` are normal route handlers and must NOT be exempt from
 *    the proxy, because the session refresh has to run on them too.
 *  - A new case covers the failure that took the site down: an identity
 *    provider that cannot answer must degrade to "no session", never throw.
 */

const mockRefresh = jest.fn();

jest.mock("@/lib/supabase/proxy-session", () => ({
  refreshSupabaseSession: (...args: unknown[]) => mockRefresh(...args),
}));

/* Configured by default so the proxy does not log a warning on every case. */
jest.mock("@/lib/supabase/env", () => ({
  supabaseConfigured: () => true,
  describeMissingConfig: () => "",
}));

// Imported after the mocks so the proxy picks up the stubs.
import { proxy } from "@/proxy";

function requestFor(pathname: string, search = "", cookies: Record<string, string> = {}) {
  return {
    nextUrl: { pathname, search },
    url: `http://localhost${pathname}${search}`,
    cookies: {
      get: (name: string) => (name in cookies ? { name, value: cookies[name] } : undefined),
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
      set: jest.fn(),
    },
  } as unknown as Parameters<typeof proxy>[0];
}

/** What `refreshSupabaseSession` resolves to. */
function session({ hasSession = false, available = true } = {}) {
  return { response: NextResponse.next(), hasSession, available };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRefresh.mockResolvedValue(session());
});

describe("proxy", () => {
  it.each(["/admin", "/admin/users", "/therapist", "/dashboard/sessions"])(
    "redirects unauthenticated protected route %s to sign-in",
    async (pathname) => {
      const response = await proxy(requestFor(pathname));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") as string);
      expect(location.pathname).toBe("/signin");
      // The user must land back where they were headed after authenticating.
      expect(location.searchParams.get("next")).toBe(pathname);
    }
  );

  it("preserves the query string in the return path", async () => {
    const response = await proxy(requestFor("/dashboard/sessions", "?tab=upcoming"));

    const location = new URL(response.headers.get("location") as string);
    expect(location.searchParams.get("next")).toBe("/dashboard/sessions?tab=upcoming");
  });

  it("allows protected routes when a session exists", async () => {
    mockRefresh.mockResolvedValue(session({ hasSession: true }));

    const response = await proxy(requestFor("/dashboard"));

    expect(response.status).toBe(200);
  });

  it("refreshes the session on every covered request, not only protected ones", async () => {
    /* The refresh is why sessions survive past the first token expiry — see
       the note in `lib/supabase/proxy-session.ts`. A request to an ordinary
       covered path must still trigger it. */
    await proxy(requestFor("/api/me"));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not gate public routes", async () => {
    const response = await proxy(requestFor("/faq"));

    expect(response.status).toBe(200);
  });

  it("does not treat /admin-tools as the protected /admin section", async () => {
    /* Segment boundary: a prefix match would exempt nothing, but a sloppy
       `startsWith("/admin")` would GATE an unrelated public path. */
    const response = await proxy(requestFor("/admin-tools"));

    expect(response.status).toBe(200);
  });

  it("gates /therapist but not /therapists or /therapist-jobs", async () => {
    /* The dangerous direction: `/therapists` is the public directory and
       `/therapist-jobs` is public recruiting, while `/therapist` is the
       clinician portal. Confusing them either leaks the portal or 307s two
       marketing pages. */
    expect((await proxy(requestFor("/therapists"))).status).toBe(200);
    expect((await proxy(requestFor("/therapist-jobs"))).status).toBe(200);
    expect((await proxy(requestFor("/therapist"))).status).toBe(307);
  });

  it("does not exempt /auth/* from the session refresh", async () => {
    /*
     * Under Auth0 these were SDK-served and short-circuited before the gate.
     * Under Supabase `/auth/callback` is an ordinary route handler that needs
     * the refresh to run, so the exemption was removed. If someone reinstates
     * it, the callback stops writing rotated cookies.
     */
    await proxy(requestFor("/auth/callback", "?code=abc"));

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  describe("when the identity provider cannot answer", () => {
    /*
     * The regression this guards. `auth0.middleware()` used to be called
     * unguarded on the proxy's first line, so removing the provider's env vars
     * returned 500 for every path the matcher covered — all of `/api/*`, all
     * three portals, and `/ingest/*`, the reverse proxy browser analytics goes
     * through. The marketing pages kept working because they are excluded,
     * which made the site look healthy from outside while everything behind it
     * was down.
     */
    beforeEach(() => {
      mockRefresh.mockResolvedValue(session({ hasSession: false, available: false }));
    });

    it("does not throw, and lets unprotected routes through", async () => {
      const response = await proxy(requestFor("/api/me"));

      expect(response.status).toBe(200);
    });

    it("still refuses protected routes rather than failing open", async () => {
      const response = await proxy(requestFor("/admin"));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location") as string).pathname).toBe("/signin");
    });
  });
});
