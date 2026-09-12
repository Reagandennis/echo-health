import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";

import { getLoggedInUser } from "@/lib/auth/session";
import { withAnonymous } from "@/lib/db/session";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Returns chat history for a given sessionId.
 *
 * Authorization:
 *  - Logged-in users: must match the email on the chat session row.
 *  - Anonymous users: must present the same email they used to start the
 *    session (sent as ?email=). This is a soft check — we cannot fully
 *    authenticate anonymous users, but it prevents trivial session-id
 *    enumeration from dumping other people's transcripts.
 *
 * The two chat tables have permissive RLS (they have no user column to bind an
 * anonymous visitor to), so this check is the ONLY thing standing between a
 * guessed session id and a transcript. It runs before any message is read.
 */
export async function GET(req: NextRequest) {
  const limit = await rateLimit(`chat-history:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const claimedEmail = req.nextUrl.searchParams.get("email");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  let sessionEmail: string | null = null;
  try {
    sessionEmail = await withAnonymous(async (tx) => {
      const [row] = await tx
        .select({ email: chatSessions.email })
        .from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId))
        .limit(1);
      return row?.email ?? null;
    });
  } catch {
    return NextResponse.json({ messages: [] });
  }

  if (!sessionEmail) {
    return NextResponse.json({ messages: [] });
  }

  const loggedIn = await getLoggedInUser();
  const claimMatches =
    (loggedIn?.email !== undefined &&
      loggedIn.email.toLowerCase() === sessionEmail.toLowerCase()) ||
    (claimedEmail !== null && claimedEmail.toLowerCase() === sessionEmail.toLowerCase());

  if (!claimMatches) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const messages = await withAnonymous(async (tx) => {
      const rows = await tx
        .select({
          id: chatMessages.id,
          role: chatMessages.role,
          text: chatMessages.text,
        })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(200);
      return rows;
    });
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
