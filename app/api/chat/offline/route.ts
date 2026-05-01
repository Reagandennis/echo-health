import { NextRequest, NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite/server";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "";
const SESSIONS_COLLECTION_ID = "chat_sessions";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) return NextResponse.json({ ok: false });

    const { databases } = createAdminClient();
    const sessions = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: SESSIONS_COLLECTION_ID,
      queries: [Query.equal("sessionId", [sessionId])],
    });

    if (sessions.total > 0) {
      await databases.updateDocument({
        databaseId: DATABASE_ID,
        collectionId: SESSIONS_COLLECTION_ID,
        documentId: sessions.documents[0].$id,
        data: { isOnline: false },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
