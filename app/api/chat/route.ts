import { NextRequest, NextResponse } from "next/server";

import { getLoggedInUser } from "@/lib/auth/session";
import { withAnonymous } from "@/lib/db/session";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { parseOrError, chatMessageSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Loose per-IP rate limit — chat is anonymous-friendly so we can't key on user id alone.
  const limit = await rateLimit(`chat:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = parseOrError(chatMessageSchema, await req.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const { sessionId, text } = parsed.data;

  // SECURITY: name/email/role are derived server-side. Authenticated users
  // get their actual identity; anonymous visitors get the values they submitted
  // on the gate form (still untrusted, but now tied to an isOnline session row).
  const loggedIn = await getLoggedInUser();
  const isHeartbeat = text === "heartbeat";
  const role = isHeartbeat ? "system" : "user";
  const name = loggedIn?.name ?? parsed.data.name;
  const email = loggedIn?.email ?? parsed.data.email;

  try {
    // `withAnonymous` rather than `withCurrentUser`: this endpoint serves
    // visitors with no Auth0 session at all. The two chat tables have
    // deliberately permissive RLS policies (see migration 0001) because there is
    // no user column to bind an anonymous visitor to — read authorization lives
    // in application code, in `history/route.ts`.
    await withAnonymous(async (tx) => {
      if (!isHeartbeat) {
        await tx
          .insert(chatMessages)
          .values({ sessionId, name, email, role, text });
      }

      // `chat_sessions.session_id` is uniquely indexed, so this upsert replaces
      // the previous read-then-branch and closes the race between two concurrent
      // first messages on the same session.
      await tx
        .insert(chatSessions)
        .values({
          sessionId,
          userId: loggedIn?.$id ?? null,
          name,
          email,
          lastMessage: text,
          lastActive: new Date(),
          isOnline: true,
        })
        .onConflictDoUpdate({
          target: chatSessions.sessionId,
          set: {
            name,
            email,
            lastMessage: text,
            lastActive: new Date(),
            isOnline: true,
          },
        });
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("Chat write error:", message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
