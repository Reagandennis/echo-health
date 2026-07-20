import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getLoggedInUser } from "@/lib/auth/session";
import { withCurrentUser } from "@/lib/db/session";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { sendEmailNotification } from "@/lib/email";

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

    await withCurrentUser(async (tx) => {
      // 1. Save admin message.
      await tx.insert(chatMessages).values({
        sessionId,
        name: "Admin",
        email: "support@echohealth.com",
        role: "admin",
        text,
      });

      // 2. Update the session's last-message summary. A no-op when the session
      //    row is missing, which is the same outcome the previous
      //    list-then-branch produced.
      await tx
        .update(chatSessions)
        .set({ lastMessage: text, lastActive: new Date() })
        .where(eq(chatSessions.sessionId, sessionId));
    });

    // 3. Send email notification (always emailed for this build, via Resend).
    await sendEmailNotification(userEmail, userName, text);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("Admin reply error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
