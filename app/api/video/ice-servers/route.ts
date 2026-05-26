import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/server";
import { rateLimit } from "@/lib/rate-limit";

// Short-lived TURN credentials. Long enough to cover a typical 50-minute
// therapy session plus reconnects; short enough that a leaked credential
// can't be abused for long.
const TURN_CREDENTIAL_TTL_SECONDS = 3600;

export async function POST() {
  try {
    const TOKEN_ID = process.env.CLOUDFLARE_TURN_TOKEN_ID;
    const API_TOKEN = process.env.CLOUDFLARE_TURN_API_TOKEN;
    if (!TOKEN_ID || !API_TOKEN) {
      return NextResponse.json(
        { error: "Cloudflare TURN credentials not configured" },
        { status: 500 }
      );
    }

    const user = await getLoggedInUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = rateLimit(`turn:${user.$id}`, { limit: 30, windowMs: 60_000 });
    if (!limit.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${TOKEN_ID}/credentials/generate-ice-servers`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_SECONDS }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Cloudflare TURN Error:", response.status, errorData);
      return NextResponse.json(
        { error: "Cloudflare TURN Error" },
        { status: response.status }
      );
    }

    const result = await response.json();
    // Cloudflare returns `iceServers` as either a single object or an array
    // depending on API version. RTCConfiguration.iceServers must be an array.
    const iceServers = Array.isArray(result.iceServers)
      ? result.iceServers
      : [result.iceServers];

    return NextResponse.json({ iceServers });
  } catch (error) {
    console.error("ICE servers route error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
