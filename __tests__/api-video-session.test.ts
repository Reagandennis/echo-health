/**
 * @jest-environment node
 */
function jsonRequest(body: unknown) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Request;
}

async function loadPost() {
  const mod = await import("@/app/api/video/session/route");
  return mod.POST;
}

describe("/api/video/session", () => {
  const originalAppId = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID;
  const originalToken = process.env.CLOUDFLARE_CALLS_API_TOKEN;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID = "cf-app";
    process.env.CLOUDFLARE_CALLS_API_TOKEN = "cf-token";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ sessionId: "session-1" }),
    }) as unknown as typeof fetch;
  });

  afterAll(() => {
    if (originalAppId === undefined) {
      delete process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID;
    } else {
      process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID = originalAppId;
    }

    if (originalToken === undefined) {
      delete process.env.CLOUDFLARE_CALLS_API_TOKEN;
    } else {
      process.env.CLOUDFLARE_CALLS_API_TOKEN = originalToken;
    }

    global.fetch = originalFetch;
  });

  it("requires Cloudflare credentials", async () => {
    delete process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID;
    const POST = await loadPost();

    const response = await POST(jsonRequest({ endpoint: "/sessions/new" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain("credentials");
  });

  it("requires an endpoint", async () => {
    const POST = await loadPost();

    const response = await POST(jsonRequest({ data: {} }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Endpoint is required");
  });

  it("forwards valid requests to Cloudflare Calls", async () => {
    const POST = await loadPost();

    const response = await POST(
      jsonRequest({
        endpoint: "/sessions/new",
        data: { name: "test" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessionId).toBe("session-1");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://rtc.live.cloudflare.com/v1/apps/cf-app/sessions/new",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer cf-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name: "test" }),
      })
    );
  });
});
