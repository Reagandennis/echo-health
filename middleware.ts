import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { cookies } from "next/headers";
import { getProfile } from "@/lib/appwrite/database";

// Helper to enforce admin role in API routes
export async function requireAdminRole() {
  const cookieStore = cookies();
  const session = cookieStore.get("appwrite-session");
  if (!session) throw new Error("Unauthorized");
  // Fetch user profile and check role
  // You may need to decode the session or fetch userId from session
  // For now, assume userId is stored in a cookie (replace as needed)
  const userId = cookieStore.get("userId")?.value;
  if (!userId) throw new Error("Unauthorized");
  const profile = await getProfile(userId);
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return profile;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get("appwrite-session");

  // Basic session check for protected routes
  // We rely on Server Component Layouts for role-based verification (admin/therapist)
  // This avoids redundant network calls to Appwrite on every request.
  const isProtectedRoute = pathname.startsWith("/admin") || 
                           pathname.startsWith("/therapist") || 
                           pathname.startsWith("/dashboard");

  if (isProtectedRoute && (!session || !session.value)) {
    return NextResponse.redirect(new URL("/signin", request.url));
  }

  // NOTE: We removed the redirect away from auth pages (/signin, /signup) 
  // because it can cause redirect loops if the session cookie is invalid/expired.
  // The layout components will handle verifying the user and redirecting if necessary.

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/therapist/:path*", "/dashboard/:path*", "/signin", "/signup"],
};
