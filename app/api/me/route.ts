import { NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Client-side session hydration endpoint, consumed by `<UserProvider hydrate>`.
 *
 * Returns an explicit allowlist of fields rather than the whole session user —
 * this response reaches the browser, so nothing beyond these may be added
 * without checking it is safe to expose.
 */
export async function GET() {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      $id: user.$id,
      name: user.name,
      email: user.email,
      labels: user.labels,
      prefs: user.prefs,
      picture: user.picture,
      emailVerification: user.emailVerification,
    },
  });
}
