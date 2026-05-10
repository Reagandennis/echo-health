/**
 * @jest-environment node
 */
import { POST } from "@/app/api/admin/therapist-kyc/route";
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

describe("/api/admin/therapist-kyc", () => {
  const databases = {
    updateDocument: jest.fn(),
  };
  const users = {
    get: jest.fn(),
    updateLabels: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateAdminClient.mockReturnValue({ databases, users } as unknown as ReturnType<typeof createAdminClient>);
    mockedGetLoggedInUser.mockResolvedValue({ $id: "admin-1", labels: ["admin"] });
    databases.updateDocument.mockResolvedValue({ $id: "therapist-doc", userId: "therapist-user" });
    users.get.mockResolvedValue({ labels: ["client", "beta"] });
  });

  it("requires an admin user", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "user-1", labels: ["client"] });

    const response = await POST(jsonRequest({ therapistDocId: "therapist-doc", action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Unauthorized");
    expect(databases.updateDocument).not.toHaveBeenCalled();
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(jsonRequest({ therapistDocId: "", action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid payload");
  });

  it("approves KYC and ensures the user has only the therapist role label", async () => {
    const response = await POST(jsonRequest({ therapistDocId: "therapist-doc", action: "approve" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, kycStatus: "verified" });
    const updateCall = databases.updateDocument.mock.calls[0];
    expect(updateCall[2]).toBe("therapist-doc");
    expect(updateCall[3]).toEqual({ kycStatus: "verified" });
    expect(users.updateLabels).toHaveBeenCalledWith("therapist-user", ["beta", "therapist"]);
  });

  it("rejects KYC without changing user role labels", async () => {
    const response = await POST(jsonRequest({ therapistDocId: "therapist-doc", action: "reject" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, kycStatus: "rejected" });
    expect(users.get).not.toHaveBeenCalled();
    expect(users.updateLabels).not.toHaveBeenCalled();
  });
});
