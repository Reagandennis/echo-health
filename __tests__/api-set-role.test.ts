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

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
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

    const response = await POST(jsonRequest({ userId: "user-1", role: "admin" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid request.");
    expect(users.updateLabels).not.toHaveBeenCalled();
  });

  it("prevents non-admin users from setting another user's role", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });

    const response = await POST(jsonRequest({ userId: "user-2", role: "client" }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toContain("Cannot set role");
    expect(users.updateLabels).not.toHaveBeenCalled();
  });

  it("allows a new user to set their first role", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: [] });
    users.get.mockResolvedValue({ labels: ["beta"] });

    const response = await POST(jsonRequest({ userId: "user-1", role: "client" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(users.updateLabels).toHaveBeenCalledWith("user-1", ["beta", "client"]);
  });

  it("lets admins replace existing client or therapist labels while preserving other labels", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "admin-1", labels: ["admin"] });
    users.get.mockResolvedValue({ labels: ["client", "admin"] });

    const response = await POST(jsonRequest({ userId: "user-1", role: "therapist" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(users.updateLabels).toHaveBeenCalledWith("user-1", ["admin", "therapist"]);
  });
});
