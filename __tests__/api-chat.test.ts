/**
 * @jest-environment node
 */
import { POST } from "@/app/api/chat/route";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";

jest.mock("@/lib/appwrite/server", () => ({
  createAdminClient: jest.fn(),
  getLoggedInUser: jest.fn(),
}));

jest.mock("node-appwrite", () => ({
  ID: {
    unique: jest.fn(() => "unique-id"),
  },
  Query: {
    equal: jest.fn((field: string, value: string[]) => ({ field, value })),
  },
  Permission: {
    read: jest.fn((role: string) => `read:${role}`),
  },
  Role: {
    user: jest.fn((id: string) => `user:${id}`),
    label: jest.fn((label: string) => `label:${label}`),
  },
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

describe("/api/chat", () => {
  const databases = {
    createDocument: jest.fn(),
    listDocuments: jest.fn(),
    updateDocument: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateAdminClient.mockReturnValue({ databases } as unknown as ReturnType<typeof createAdminClient>);
    mockedGetLoggedInUser.mockResolvedValue(null);
    databases.listDocuments.mockResolvedValue({ total: 0, documents: [] });
    databases.createDocument.mockResolvedValue({ $id: "created-doc" });
    databases.updateDocument.mockResolvedValue({ $id: "session-doc" });
  });

  it("rejects messages missing required fields", async () => {
    const response = await POST(
      jsonRequest({ sessionId: "session-1", text: "Hello" }, { "x-forwarded-for": "10.0.0.1" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/email|name/i);
    expect(databases.createDocument).not.toHaveBeenCalled();
  });

  it("ignores client-supplied role and forces 'user' for anonymous messages", async () => {
    const response = await POST(
      jsonRequest(
        {
          sessionId: "session-1",
          name: "Ada",
          email: "ada@example.com",
          text: "I need help",
        },
        { "x-forwarded-for": "10.0.0.2" }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(databases.createDocument).toHaveBeenCalledTimes(2);
    const messageCreateCall = databases.createDocument.mock.calls[0];
    expect(messageCreateCall[3]).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        text: "I need help",
      })
    );
    // Anonymous: admin-only read ACL (no Role.any leak)
    expect(messageCreateCall[4]).toEqual(["read:label:admin"]);
  });

  it("derives identity from the authenticated session, ignoring client-supplied name/email", async () => {
    mockedGetLoggedInUser.mockResolvedValue({
      $id: "user-1",
      name: "Authed",
      email: "authed@example.com",
    });

    const response = await POST(
      jsonRequest(
        {
          sessionId: "session-1",
          name: "Pretend",
          email: "spoof@example.com",
          text: "hello",
        },
        { "x-forwarded-for": "10.0.0.3" }
      )
    );

    expect(response.status).toBe(200);
    const messageCreateCall = databases.createDocument.mock.calls[0];
    expect(messageCreateCall[3]).toEqual(
      expect.objectContaining({ name: "Authed", email: "authed@example.com", role: "user" })
    );
    expect(messageCreateCall[4]).toEqual(
      expect.arrayContaining(["read:label:admin", "read:user:user-1"])
    );
  });

  it("does not store heartbeat messages but still updates session presence", async () => {
    databases.listDocuments.mockResolvedValue({
      total: 1,
      documents: [{ $id: "existing-session" }],
    });

    const response = await POST(
      jsonRequest(
        {
          sessionId: "session-1",
          name: "Ada",
          email: "ada@example.com",
          text: "heartbeat",
        },
        { "x-forwarded-for": "10.0.0.4" }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(databases.createDocument).not.toHaveBeenCalled();
    const sessionUpdateCall = databases.updateDocument.mock.calls[0];
    expect(sessionUpdateCall[2]).toBe("existing-session");
    expect(sessionUpdateCall[3]).toEqual(
      expect.objectContaining({
        lastMessage: "heartbeat",
        isOnline: true,
      })
    );
  });
});
