import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
