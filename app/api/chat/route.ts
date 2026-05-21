import { NextRequest, NextResponse } from "next/server";
import { ID, Query, Permission, Role } from "node-appwrite";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { parseOrError, chatMessageSchema } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const DATABASE_ID = appwriteConfig.databaseId;
const MESSAGES_COLLECTION_ID = appwriteConfig.collections.chatMessages;
const SESSIONS_COLLECTION_ID = appwriteConfig.collections.chatSessions;

export async function POST(req: NextRequest) {
  // Loose per-IP rate limit — chat is anonymous-friendly so we can't key on user id alone.
  const limit = rateLimit(`chat:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
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
  // on the gate form (still untrusted, but now tied to an isOnline session row
  // and ACL-scoped to admin-only reads).
  const loggedIn = await getLoggedInUser();
  const isHeartbeat = text === "heartbeat";
  const role = isHeartbeat ? "system" : "user";
  const name = loggedIn?.name ?? parsed.data.name;
  const email = loggedIn?.email ?? parsed.data.email;

  const { databases } = createAdminClient();

  try {
    if (!isHeartbeat) {
      const readers = [Permission.read(Role.label("admin"))];
      if (loggedIn) {
        readers.push(Permission.read(Role.user(loggedIn.$id)));
      }
      await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        ID.unique(),
        { sessionId, name, email, role, text },
        readers
      );
    }

    const existing = await databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [
      Query.equal("sessionId", [sessionId]),
    ]);

    const sessionData = {
      sessionId,
      name,
      email,
      lastMessage: text,
      lastActive: new Date().toISOString(),
      isOnline: true,
    };

    if (existing.total > 0) {
      await databases.updateDocument(
        DATABASE_ID,
        SESSIONS_COLLECTION_ID,
        existing.documents[0].$id,
        sessionData
      );
    } else {
      await databases.createDocument(
        DATABASE_ID,
        SESSIONS_COLLECTION_ID,
        ID.unique(),
        sessionData
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("Chat write error:", message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
