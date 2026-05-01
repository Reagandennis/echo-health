import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { sendEmailNotification } from "@/lib/email";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "";
const MESSAGES_COLLECTION_ID = "chat_messages";
const SESSIONS_COLLECTION_ID = "chat_sessions";

export async function POST(req: NextRequest) {
  try {
    const user = await getLoggedInUser();
    if (!user || !user.labels?.includes("admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, text, userEmail, userName } = (await req.json()) as {
      sessionId: string;
      text: string;
      userEmail: string;
      userName: string;
    };

    if (!sessionId || !text || !userEmail || !userName) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const { databases } = createAdminClient();

    // 1. Save Admin Message
    await databases.createDocument({
      databaseId: DATABASE_ID,
      collectionId: MESSAGES_COLLECTION_ID,
      documentId: ID.unique(),
      data: {
        sessionId,
        name: "Admin",
        email: "support@echohealth.com",
        role: "admin",
        text,
      },
    });

    // 2. Update Session last message
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
        data: {
          lastMessage: text,
          lastActive: new Date().toISOString(),
        },
      });
    }

    // 3. Send Email Notification (as requested, always email use resend API for this build)
    await sendEmailNotification(userEmail, userName, text);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("Admin reply error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
