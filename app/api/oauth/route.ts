import { createAdminClient } from "@/lib/appwrite/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");

  if (!userId || !secret) {
    return NextResponse.redirect(new URL("/signin?error=OAuthFailed", request.url));
  }

  try {
    const { account } = createAdminClient();
    
    // Create a session using the secret from the OAuth provider
    const session = await account.createSession(userId, secret);

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    // Determine where to redirect based on user labels
    const user = await account.get();
    
    if (user.labels?.includes("admin")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    
    if (user.labels?.includes("therapist")) {
      return NextResponse.redirect(new URL("/therapist", request.url));
    }

    if (!user.labels?.includes("client")) {
      return NextResponse.redirect(new URL("/role-select", request.url));
    }

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("OAuth Callback Error:", error);
    return NextResponse.redirect(new URL("/signin?error=OAuthError", request.url));
  }
}
