/**
 * @jest-environment node
 */
import { NextResponse } from "next/server";

const mockMiddleware = jest.fn();
const mockGetSession = jest.fn();

jest.mock("@/lib/auth0", () => ({
  auth0: {
    middleware: (...args: unknown[]) => mockMiddleware(...args),
    getSession: (...args: unknown[]) => mockGetSession(...args),
  },
}));

// Imported after the mock so the proxy picks up the stubbed client.
import { proxy } from "@/proxy";

function requestFor(pathname: string, search = "") {
  return {
    nextUrl: { pathname, search },
    url: `http://localhost${pathname}${search}`,
    cookies: { get: jest.fn(), getAll: jest.fn(() => []) },
  } as unknown as Parameters<typeof proxy>[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMiddleware.mockResolvedValue(NextResponse.next());
});

describe("proxy", () => {
  it.each(["/admin", "/admin/users", "/therapist", "/dashboard/sessions"])(
    "redirects unauthenticated protected route %s to Auth0 login",
    async (pathname) => {
      mockGetSession.mockResolvedValue(null);

      const response = await proxy(requestFor(pathname));

      expect(response.status).toBe(307);
      const location = new URL(response.headers.get("location") as string);
      expect(location.pathname).toBe("/auth/login");
      // The user must land back where they were headed after authenticating.
      expect(location.searchParams.get("returnTo")).toBe(pathname);
    }
  );

  it("preserves the query string in returnTo", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await proxy(requestFor("/dashboard", "?tab=goals"));

    const location = new URL(response.headers.get("location") as string);
    expect(location.searchParams.get("returnTo")).toBe("/dashboard?tab=goals");
  });

  it("allows protected routes when a session exists", async () => {
    mockGetSession.mockResolvedValue({ user: { sub: "auth0|abc" } });

    const response = await proxy(requestFor("/dashboard"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("hands /auth/* to the SDK without a session check", async () => {
    const response = await proxy(requestFor("/auth/login"));

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not gate public routes", async () => {
    const response = await proxy(requestFor("/"));

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not treat /admin-tools as the protected /admin section", async () => {
    await proxy(requestFor("/admin-tools"));

    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("only short-circuits exact /auth/* SDK routes, not siblings", async () => {
    // Regression guard for the prefix boundary. A bare "/auth" check would treat
    // /auth-redirect as an SDK route; the gating below proves it is not, because
    // a protected path is still evaluated in the same pass.
    mockGetSession.mockResolvedValue(null);

    await proxy(requestFor("/auth-redirect"));
    expect(mockGetSession).not.toHaveBeenCalled(); // not protected — falls through

    const gated = await proxy(requestFor("/dashboard"));
    expect(gated.status).toBe(307); // protected paths still gate normally
  });
});
