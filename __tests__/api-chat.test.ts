/**
 * @jest-environment node
 */
import { POST } from "@/app/api/chat/route";
import { createAdminClient } from "@/lib/appwrite/server";

jest.mock("@/lib/appwrite/server", () => ({
  createAdminClient: jest.fn(),
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
    any: jest.fn(() => "any"),
    label: jest.fn((label: string) => `label:${label}`),
  },
}));

const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
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
    databases.listDocuments.mockResolvedValue({ total: 0, documents: [] });
    databases.createDocument.mockResolvedValue({ $id: "created-doc" });
    databases.updateDocument.mockResolvedValue({ $id: "session-doc" });
  });

  it("rejects messages missing required fields", async () => {
    const response = await POST(jsonRequest({ sessionId: "session-1", text: "Hello" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Missing required fields.");
    expect(databases.createDocument).not.toHaveBeenCalled();
  });

  it("stores a user message and creates a chat session when none exists", async () => {
    const response = await POST(
      jsonRequest({
        sessionId: "session-1",
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        text: "I need help",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(databases.createDocument).toHaveBeenCalledTimes(2);
    const messageCreateCall = databases.createDocument.mock.calls[0];
    expect(messageCreateCall[1]).toBe("chat_messages");
    expect(messageCreateCall[2]).toBe("unique-id");
    expect(messageCreateCall[3]).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        text: "I need help",
      })
    );
    expect(messageCreateCall[4]).toEqual(expect.arrayContaining(["read:any", "read:label:admin"]));

    const sessionCreateCall = databases.createDocument.mock.calls[1];
    expect(sessionCreateCall[1]).toBe("chat_sessions");
    expect(sessionCreateCall[2]).toBe("unique-id");
    expect(sessionCreateCall[3]).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        lastMessage: "I need help",
        isOnline: true,
      })
    );
  });

  it("does not store heartbeat messages but still updates session presence", async () => {
    databases.listDocuments.mockResolvedValue({
      total: 1,
      documents: [{ $id: "existing-session" }],
    });

    const response = await POST(
      jsonRequest({
        sessionId: "session-1",
        name: "Ada",
        email: "ada@example.com",
        role: "system",
        text: "heartbeat",
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(databases.createDocument).not.toHaveBeenCalled();
    const sessionUpdateCall = databases.updateDocument.mock.calls[0];
    expect(sessionUpdateCall[1]).toBe("chat_sessions");
    expect(sessionUpdateCall[2]).toBe("existing-session");
    expect(sessionUpdateCall[3]).toEqual(
      expect.objectContaining({
        lastMessage: "heartbeat",
        isOnline: true,
      })
    );
  });
});
