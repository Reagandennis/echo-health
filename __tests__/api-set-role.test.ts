/**
 * @jest-environment node
 */
import { POST } from "@/app/api/user/set-role/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/supabase/management", () => ({
  isManagementConfigured: jest.fn(() => true),
  assignRole: jest.fn(),
  getUserRoles: jest.fn(async () => []),
}));

import {
  assignRole,
  getUserRoles,
  isManagementConfigured,
} from "@/lib/supabase/management";

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<
  typeof getLoggedInUser
>;
const mockedAssignRole = assignRole as jest.MockedFunction<typeof assignRole>;
const mockedGetUserRoles = getUserRoles as jest.MockedFunction<typeof getUserRoles>;
const mockedIsConfigured = isManagementConfigured as jest.MockedFunction<
  typeof isManagementConfigured
>;

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((k: string) => headers[k.toLowerCase()] ?? null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

/**
 * Roles live in the Supabase user's `app_metadata`, so assigning one is a
 * service-role write. `lib/supabase/management.ts` is mocked here: these tests
 * cover the route's authorization gates and its contract with that module, not
 * Supabase itself.
 *
 * The gates matter more than the happy path — each one is the only thing
 * standing between a self-serve signup and a privilege escalation.
 */
describe("/api/user/set-role", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsConfigured.mockReturnValue(true);
    mockedGetUserRoles.mockResolvedValue([]);
  });

  it("rejects invalid role payloads", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: [] }));

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "admin" }, { "x-forwarded-for": "10.1.0.1" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("rejects unauthenticated callers", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);
    const response = await POST(
      jsonRequest({ userId: "user-1", role: "client" }, { "x-forwarded-for": "10.1.0.2" })
    );
    expect(response.status).toBe(401);
  });

  it("prevents non-admin users from setting another user's role", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: [] }));

    const response = await POST(
      jsonRequest({ userId: "user-2", role: "client" }, { "x-forwarded-for": "10.1.0.3" })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Cannot set role");
  });

  it("blocks non-admin users from self-assigning the therapist role", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: [] }));

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "therapist" }, { "x-forwarded-for": "10.1.0.4" })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("KYC");
  });

  it("assigns the role and flags that re-authentication is required", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: [] }));

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "client" }, { "x-forwarded-for": "10.1.0.5" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedAssignRole).toHaveBeenCalledWith("user-1", "client");
    // `app_metadata` is stamped into the access token when it is issued, so
    // the caller must refresh the session before the new role is visible.
    // Silence here strands the user in a roleless session.
    expect(body.requiresReauth).toBe(true);
  });

  it("stops a non-admin from switching an already-assigned role", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1", labels: [] }));
    mockedGetUserRoles.mockResolvedValue(["client"]);

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "client" }, { "x-forwarded-for": "10.1.0.6" })
    );

    expect(response.status).toBe(403);
    expect(mockedAssignRole).not.toHaveBeenCalled();
  });

  it("lets an admin grant the therapist role", async () => {
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "admin-1", labels: ["admin"] }));

    const response = await POST(
      jsonRequest({ userId: "user-2", role: "therapist" }, { "x-forwarded-for": "10.1.0.7" })
    );

    expect(response.status).toBe(200);
    expect(mockedAssignRole).toHaveBeenCalledWith("user-2", "therapist");
  });

  it("degrades to 501 when the service-role key is absent", async () => {
    mockedIsConfigured.mockReturnValue(false);
    // Distinct subject: the rate limiter is module-scoped and keyed on user id,
    // so reusing "user-1" here would trip its 5/minute cap and return 429.
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-9", labels: [] }));

    const response = await POST(
      jsonRequest({ userId: "user-9", role: "client" }, { "x-forwarded-for": "10.1.0.8" })
    );

    expect(response.status).toBe(501);
    expect(mockedAssignRole).not.toHaveBeenCalled();
  });
});
