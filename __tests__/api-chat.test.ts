/**
 * @jest-environment node
 */
import { POST } from "@/app/api/chat/route";
import { getLoggedInUser } from "@/lib/auth/session";
import { withAnonymous } from "@/lib/db/session";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { mockUser } from "@/test-utils/session";

jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/db/session", () => ({
  withAnonymous: jest.fn(),
}));

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<
  typeof getLoggedInUser
>;
const mockedWithAnonymous = withAnonymous as jest.MockedFunction<
  typeof withAnonymous
>;

type InsertRecord = {
  table: unknown;
  values: Record<string, unknown>;
  conflict?: unknown;
};

/**
 * A stand-in for the Drizzle transaction handle.
 *
 * The route builds two statements: a plain `insert().values()` for the message
 * and an `insert().values().onConflictDoUpdate()` upsert for the session. The
 * chain therefore has to be awaitable at BOTH links, so `values()` returns a
 * thenable that also carries `onConflictDoUpdate`.
 *
 * Recorded calls are tagged with the schema object they targeted, so assertions
 * can tell the two tables apart without depending on call ordering.
 */
function makeTx() {
  const inserts: InsertRecord[] = [];

  const tx = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          const record: InsertRecord = { table, values };
          inserts.push(record);
          return {
            onConflictDoUpdate(conflict: unknown) {
              record.conflict = conflict;
              return Promise.resolve([]);
            },
            then(resolve: (v: unknown) => unknown) {
              return Promise.resolve([]).then(resolve);
            },
          };
        },
      };
    },
  };

  return { tx, inserts };
}

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((k: string) => headers[k.toLowerCase()] ?? null),
    },
  } as unknown as Parameters<typeof POST>[0];
}

describe("/api/chat", () => {
  let inserts: InsertRecord[];

  const messageInserts = () => inserts.filter((i) => i.table === chatMessages);
  const sessionInserts = () => inserts.filter((i) => i.table === chatSessions);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetLoggedInUser.mockResolvedValue(null);

    const harness = makeTx();
    inserts = harness.inserts;
    // The route runs with NO identity — support chat is anonymous-friendly and
    // the two chat tables have deliberately permissive RLS.
    // Only the fake handle is cast; `fn` keeps its real signature so a drift in
    // `withAnonymous`'s contract still fails to compile here.
    mockedWithAnonymous.mockImplementation(async (fn) => fn(harness.tx as never));
  });

  it("rejects messages missing required fields", async () => {
    const response = await POST(
      jsonRequest({ sessionId: "session-1", text: "Hello" }, { "x-forwarded-for": "10.0.0.1" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/email|name/i);
    expect(mockedWithAnonymous).not.toHaveBeenCalled();
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
    expect(messageInserts()).toHaveLength(1);
    expect(messageInserts()[0].values).toEqual(
      expect.objectContaining({
        sessionId: "session-1",
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        text: "I need help",
      })
    );
    // Anonymous visitors have no Auth0 sub to record.
    expect(sessionInserts()[0].values.userId).toBeNull();
  });

  it("derives identity from the authenticated session, ignoring client-supplied name/email", async () => {
    mockedGetLoggedInUser.mockResolvedValue(
      mockUser({ $id: "user-1", name: "Authed", email: "authed@example.com" })
    );

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
    expect(messageInserts()[0].values).toEqual(
      expect.objectContaining({
        name: "Authed",
        email: "authed@example.com",
        role: "user",
      })
    );
    expect(sessionInserts()[0].values.userId).toBe("user-1");
  });

  it("does not store heartbeat messages but still updates session presence", async () => {
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
    expect(messageInserts()).toHaveLength(0);
    expect(sessionInserts()).toHaveLength(1);
    expect(sessionInserts()[0].values).toEqual(
      expect.objectContaining({ lastMessage: "heartbeat", isOnline: true })
    );
  });

  it("upserts session presence rather than reading first, closing the first-message race", async () => {
    await POST(
      jsonRequest(
        { sessionId: "session-1", name: "Ada", email: "ada@example.com", text: "hi" },
        { "x-forwarded-for": "10.0.0.5" }
      )
    );

    const upsert = sessionInserts()[0];
    expect(upsert.conflict).toEqual(
      expect.objectContaining({
        target: chatSessions.sessionId,
        set: expect.objectContaining({ lastMessage: "hi", isOnline: true }),
      })
    );
  });
});
