import { NextRequest, NextResponse } from "next/server";
import { getLoggedInUser } from "@/lib/appwrite/server";
import { parseOrError, recordingToggleSchema } from "@/lib/validation";
import { toggleSessionRecordingAction } from "@/app/actions/database";
import { rateLimit } from "@/lib/rate-limit";

/**
 * PATCH /api/video/session/[sessionId]/recording
 *
 * Therapist-only toggle for whether the Realtime Kit meeting auto-records on
 * start. Only effective before participants join. Patient consent must be
 * captured separately before recording PHI.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`video-recording:${user.$id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const parsed = parseOrError(recordingToggleSchema, await req.json());
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const updated = await toggleSessionRecordingAction(sessionId, parsed.data.enabled);
    return NextResponse.json({ ok: true, recordingEnabled: parsed.data.enabled, session: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update recording state";
    const status = msg === "Forbidden" ? 403 : msg === "Not authenticated" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
