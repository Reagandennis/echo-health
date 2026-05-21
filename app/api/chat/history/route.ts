import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const DATABASE_ID = appwriteConfig.databaseId;
const MESSAGES_COLLECTION_ID = appwriteConfig.collections.chatMessages;
const SESSIONS_COLLECTION_ID = appwriteConfig.collections.chatSessions;

/**
 * Returns chat history for a given sessionId.
 *
 * Authorization:
 *  - Logged-in users: must match the email on the chat session row.
 *  - Anonymous users: must present the same email they used to start the
 *    session (sent as ?email=). This is a soft check — we cannot fully
 *    authenticate anonymous users, but it prevents trivial session-id
 *    enumeration from dumping other people's transcripts.
 */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`chat-history:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  const claimedEmail = req.nextUrl.searchParams.get("email");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const { databases } = createAdminClient();

  let sessionEmail: string | null = null;
  try {
    const sessionRow = await databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [
      Query.equal("sessionId", [sessionId]),
      Query.limit(1),
    ]);
    sessionEmail = (sessionRow.documents[0]?.email as string | undefined) ?? null;
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
    const res = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal("sessionId", [sessionId]),
      Query.orderAsc("$createdAt"),
      Query.limit(200),
    ]);
    const messages = res.documents.map((d) => ({
      id: d.$id,
      role: d.role,
      text: d.text,
    }));
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}
