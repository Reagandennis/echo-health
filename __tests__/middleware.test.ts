/**
 * @jest-environment node
 */
import { middleware } from "@/middleware";

function requestFor(pathname: string, sessionValue?: string) {
  return {
    nextUrl: { pathname },
    url: `http://localhost${pathname}`,
    cookies: {
      get: jest.fn(() =>
        sessionValue === undefined
          ? undefined
          : { name: "appwrite-session", value: sessionValue }
      ),
    },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("middleware", () => {
  it.each(["/admin", "/admin/users", "/therapist", "/dashboard/sessions"])(
    "redirects unauthenticated protected route %s to signin",
    async (pathname) => {
      const response = await middleware(requestFor(pathname));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost/signin");
    }
  );

  it("allows protected routes when the appwrite session cookie exists", async () => {
    const response = await middleware(requestFor("/dashboard", "session-secret"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows auth routes without forcing a redirect", async () => {
    const response = await middleware(requestFor("/signin"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
