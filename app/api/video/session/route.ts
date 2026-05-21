import { NextRequest, NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/server";
import { parseOrError, videoSessionSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID;
    const API_TOKEN = process.env.CLOUDFLARE_CALLS_API_TOKEN;
    if (!APP_ID || !API_TOKEN) {
      return NextResponse.json({ error: "Cloudflare credentials not configured" }, { status: 500 });
    }

    // SECURITY: previously this route accepted arbitrary endpoint+method from
    // any unauthenticated caller, turning it into an open proxy to Cloudflare
    // Calls — exfiltrating credits, hijacking other apps' sessions. Now:
    //   1. Require an authenticated session.
    //   2. Validate the endpoint against an allowlist (no path traversal).
    //   3. Reject methods outside GET/POST/PUT.
    //   4. Per-user rate limit.
    const user = await getLoggedInUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`video:${user.$id}`, { limit: 60, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = parseOrError(videoSessionSchema, await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const { endpoint, method, data } = parsed.data;

    const url = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}${endpoint}`;
    const response = await fetch(url, {
      method: method ?? "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Cloudflare Calls Error:", response.status, errorData);
      return NextResponse.json(
        { error: "Cloudflare API Error", details: errorData },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Video Session API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
