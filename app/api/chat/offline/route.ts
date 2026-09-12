import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { withAnonymous } from "@/lib/db/session";
import { chatSessions } from "@/lib/db/schema";
import { chatOfflineSchema, parseOrError } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Presence beacon: marks a support-chat session offline when the visitor leaves.
 *
 * AUTHORIZATION MODEL. This endpoint is deliberately unauthenticated, because
 * the visitors it serves are anonymous and have no account to check. The
 * session id is the credential: it is a `crypto.randomUUID()` (122 bits) minted
 * in the browser, so holding it is equivalent to being that visitor.
 *
 * That only holds if the id cannot be *guessed*, which is what the two guards
 * below are for. Previously this route had neither: it accepted any string and
 * was unmetered, so a caller could walk the id space and flip other people's
 * conversations offline. The blast radius was small — presence is not private
 * data, and RLS still prevents reading anything — but it was free to abuse.
 *
 *  1. Shape check: only a well-formed UUID is even attempted.
 *  2. Per-IP rate limit: makes enumeration impractical rather than merely tedious.
 *
 * Note `rateLimit` is defence-in-depth, not a hard guarantee. It is shared
 * across instances when Redis is configured and per-instance otherwise, and it
 * fails open on a Redis error — so it makes enumeration expensive rather than
 * impossible. Guard 1 is what makes the id unguessable (see lib/rate-limit.ts).
 */
export async function POST(req: NextRequest) {
  const limited = await rateLimit(`chat-offline:${clientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const parsed = parseOrError(chatOfflineSchema, await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    await withAnonymous(async (tx) => {
      await tx
        .update(chatSessions)
        .set({ isOnline: false })
        .where(eq(chatSessions.sessionId, parsed.data.sessionId));
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
