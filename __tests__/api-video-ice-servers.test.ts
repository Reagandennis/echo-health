/**
 * @jest-environment node
 */
jest.mock("@/lib/auth/session", () => ({
  getLoggedInUser: jest.fn(),
}));

import { getLoggedInUser } from "@/lib/auth/session";
import { mockUser } from "@/test-utils/session";

const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<
  typeof getLoggedInUser
>;

async function loadPost() {
  const mod = await import("@/app/api/video/ice-servers/route");
  return mod.POST;
}

describe("/api/video/ice-servers", () => {
  const originalTokenId = process.env.CLOUDFLARE_TURN_TOKEN_ID;
  const originalApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CLOUDFLARE_TURN_TOKEN_ID = "turn-token-id";
    process.env.CLOUDFLARE_TURN_API_TOKEN = "turn-api-token";
    mockedGetLoggedInUser.mockResolvedValue(mockUser({ $id: "user-1" }));
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        iceServers: {
          urls: [
            "stun:stun.cloudflare.com:3478",
            "turn:turn.cloudflare.com:3478?transport=udp",
          ],
          username: "u",
          credential: "c",
        },
      }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    if (originalTokenId === undefined) {
      delete process.env.CLOUDFLARE_TURN_TOKEN_ID;
    } else {
      process.env.CLOUDFLARE_TURN_TOKEN_ID = originalTokenId;
    }
    if (originalApiToken === undefined) {
      delete process.env.CLOUDFLARE_TURN_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_TURN_API_TOKEN = originalApiToken;
    }
    global.fetch = originalFetch;
  });

  it("requires TURN credentials", async () => {
    delete process.env.CLOUDFLARE_TURN_TOKEN_ID;
    const POST = await loadPost();

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("TURN credentials");
  });

  it("rejects unauthenticated callers", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);
    const POST = await loadPost();

    const response = await POST();
    expect(response.status).toBe(401);
  });

  it("returns iceServers as an array even when Cloudflare returns a single object", async () => {
    const POST = await loadPost();

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(body.iceServers)).toBe(true);
    expect(body.iceServers[0]).toMatchObject({
      username: "u",
      credential: "c",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/turn/keys/turn-token-id/credentials/generate-ice-servers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer turn-api-token",
          "Content-Type": "application/json",
        }),
        body: expect.stringContaining('"ttl"'),
      })
    );
  });

  it("passes through array-shaped iceServers without re-wrapping", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        iceServers: [
          { urls: ["stun:stun.cloudflare.com:3478"] },
          { urls: ["turn:turn.cloudflare.com:3478"], username: "u", credential: "c" },
        ],
      }),
    });
    const POST = await loadPost();

    const response = await POST();
    const body = await response.json();

    expect(body.iceServers).toHaveLength(2);
  });

  it("propagates upstream Cloudflare errors as the same status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: jest.fn().mockResolvedValue({ error: "bad gateway" }),
    });
    const POST = await loadPost();

    const response = await POST();
    expect(response.status).toBe(502);
  });
});
