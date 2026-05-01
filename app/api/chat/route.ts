import { NextRequest, NextResponse } from "next/server";
import { ID, Query, Permission, Role } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite/server";

import { appwriteConfig } from "@/lib/appwrite/config";

const DATABASE_ID = appwriteConfig.databaseId;
const MESSAGES_COLLECTION_ID = appwriteConfig.collections.chatMessages;
const SESSIONS_COLLECTION_ID = appwriteConfig.collections.chatSessions;

export async function POST(req: NextRequest) {
  const { sessionId, name, email, role, text } = (await req.json()) as {
    sessionId: string;
    name: string;
    email: string;
    role: string;
    text: string;
  };

  console.log("New chat message received:", { sessionId, role, text });

  if (!sessionId || !name || !email || !role || !text) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const { databases } = createAdminClient();

  try {
    // 1. Save Message (if not heartbeat)
    if (text !== "heartbeat") {
      console.log("Saving message to database...");
      await databases.createDocument(
        DATABASE_ID, 
        MESSAGES_COLLECTION_ID, 
        ID.unique(), 
        {
          sessionId,
          name,
          email,
          role,
          text,
        },
        [
          Permission.read(Role.any()), // Allow clients to read their history
          Permission.read(Role.label("admin")),
        ]
      );
    }

    // 2. Update/Create Session
    console.log("Updating session:", sessionId);
    const sessions = await databases.listDocuments(DATABASE_ID, SESSIONS_COLLECTION_ID, [
      Query.equal("sessionId", [sessionId])
    ]);

    const sessionData = {
      sessionId,
      name,
      email,
      lastMessage: text,
      lastActive: new Date().toISOString(),
      isOnline: true,
    };

    if (sessions.total > 0) {
      await databases.updateDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, sessions.documents[0].$id, sessionData);
    } else {
      await databases.createDocument(DATABASE_ID, SESSIONS_COLLECTION_ID, ID.unique(), sessionData);
    }
    console.log("Session updated successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database error";
    console.error("Database operation error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
