/**
 * Tests for `lib/video.ts` — the server-side client for the Echo video backend
 * (video.echopsychology.com) that replaced the Cloudflare Calls proxy.
 *
 * These exercise the request shape (auth header, room body), the wss URL
 * construction, and the fail-closed behaviour when unconfigured or on a
 * non-OK response. `requireConfig()` reads `process.env` at call time, so the
 * env can be set per-test.
 */
import { mintVideoSession } from "@/lib/video";

describe("mintVideoSession", () => {
  const OLD_ENV = { ...process.env };
  const realFetch = global.fetch;

  beforeEach(() => {
    process.env.ECHO_VIDEO_API_URL = "https://video.echopsychology.com";
    process.env.ECHO_VIDEO_API_KEY = "sk_live_test";
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...OLD_ENV };
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it("POSTs to /sessions with the bearer key + room, and prefers the server wsPath", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        room: "sess-123",
        token: "v1.opaque-token",
        wsPath: "/ws?token=v1.opaque-token",
        iceServers: [{ urls: ["stun:stun.example:3478"] }],
        expiresAt: "2026-07-22T09:05:00Z",
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await mintVideoSession("sess-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://video.echopsychology.com/sessions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk_live_test"
    );
    expect(JSON.parse(init.body as string)).toEqual({ room: "sess-123" });

    // https → wss host + the exact server-provided signaling path.
    expect(result.wsUrl).toBe(
      "wss://video.echopsychology.com/ws?token=v1.opaque-token"
    );
    expect(result.iceServers).toEqual([{ urls: ["stun:stun.example:3478"] }]);
    expect(result.room).toBe("sess-123");
    expect(result.expiresAt).toBe("2026-07-22T09:05:00Z");
  });

  it("falls back to /ws?token=<encoded token> when wsPath is absent", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        room: "r",
        token: "tok en/with+special=chars",
        iceServers: [],
        expiresAt: "x",
      }),
    }) as unknown as typeof fetch;

    const result = await mintVideoSession("r");
    expect(result.wsUrl).toBe(
      `wss://video.echopsychology.com/ws?token=${encodeURIComponent(
        "tok en/with+special=chars"
      )}`
    );
  });

  it("throws (fails closed) when the service is not configured", async () => {
    delete process.env.ECHO_VIDEO_API_KEY;
    await expect(mintVideoSession("r")).rejects.toThrow(/not configured/i);
  });

  it("throws a terse error — not the backend body — on a non-OK response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key internal detail",
    }) as unknown as typeof fetch;

    await expect(mintVideoSession("r")).rejects.toThrow(
      /could not start the video session \(401\)/i
    );
  });

  it("strips a trailing slash on the API URL", async () => {
    process.env.ECHO_VIDEO_API_URL = "https://video.echopsychology.com/";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ room: "r", token: "t", iceServers: [], expiresAt: "x" }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await mintVideoSession("r");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://video.echopsychology.com/sessions"
    );
  });
});
