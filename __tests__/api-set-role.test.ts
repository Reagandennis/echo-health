/**
 * @jest-environment node
 */
import { POST } from "@/app/api/user/set-role/route";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";

jest.mock("@/lib/appwrite/server", () => ({
  createAdminClient: jest.fn(),
  getLoggedInUser: jest.fn(),
}));

const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((k: string) => headers[k.toLowerCase()] ?? null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe("/api/user/set-role", () => {
  const users = {
    get: jest.fn(),
    updateLabels: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateAdminClient.mockReturnValue({ users } as unknown as ReturnType<typeof createAdminClient>);
  });

  it("rejects invalid role payloads", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });

    const response = await POST(jsonRequest({ userId: "user-1", role: "admin" }, { "x-forwarded-for": "10.1.0.1" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
    expect(users.updateLabels).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);
    const response = await POST(jsonRequest({ userId: "user-1", role: "client" }, { "x-forwarded-for": "10.1.0.2" }));
    expect(response.status).toBe(401);
  });

  it("prevents non-admin users from setting another user's role", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });

    const response = await POST(jsonRequest({ userId: "user-2", role: "client" }, { "x-forwarded-for": "10.1.0.3" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Cannot set role");
    expect(users.updateLabels).not.toHaveBeenCalled();
  });

  it("blocks non-admin users from self-assigning the therapist role", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "therapist" }, { "x-forwarded-for": "10.1.0.4" })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("KYC");
    expect(users.updateLabels).not.toHaveBeenCalled();
  });

  it("allows a new user to set their first role to client", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });
    users.get.mockResolvedValue({ labels: ["beta"] });

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "client" }, { "x-forwarded-for": "10.1.0.5" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(users.updateLabels).toHaveBeenCalledWith("user-1", ["beta", "client"]);
  });

  it("lets admins replace existing client or therapist labels while preserving other labels", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "admin-1", labels: ["admin"] });
    users.get.mockResolvedValue({ labels: ["client", "admin"] });

    const response = await POST(
      jsonRequest({ userId: "user-1", role: "therapist" }, { "x-forwarded-for": "10.1.0.6" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(users.updateLabels).toHaveBeenCalledWith("user-1", ["admin", "therapist"]);
  });
});
