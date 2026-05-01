import { NextRequest, NextResponse } from "next/server";

const APP_ID = process.env.NEXT_PUBLIC_CLOUDFLARE_CALLS_APP_ID;
const API_TOKEN = process.env.CLOUDFLARE_CALLS_API_TOKEN;

export async function POST(req: NextRequest) {
  try {
    if (!APP_ID || !API_TOKEN) {
      return NextResponse.json({ error: "Cloudflare credentials not configured" }, { status: 500 });
    }

    const body = await req.json();
    const { endpoint, method = "POST", data } = body;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    const url = `https://rtc.live.cloudflare.com/v1/apps/${APP_ID}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${API_TOKEN}`,
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
