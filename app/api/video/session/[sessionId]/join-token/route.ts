import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { appwriteConfig } from "@/lib/appwrite/config";
import {
  addParticipant,
  createMeeting,
  type ParticipantPreset,
} from "@/lib/cloudflare/realtimekit";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/video/session/[sessionId]/join-token
 *
 * Returns a short-lived Cloudflare Realtime Kit participant token that the
 * browser SDK uses to join the meeting. The API token never leaves the server.
 *
 * Authorization: caller must be the patient on the session, the therapist on
 * the session, or an admin. Patients get the `group_call_participant` preset;
 * therapists and admins get `group_call_host` (mute others, recording control).
 *
 * If the session was created before the Realtime Kit migration (no
 * cloudflareMeetingId yet), this endpoint creates one lazily and persists it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const user = await getLoggedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`video-join:${user.$id}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { sessionId } = await params;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { databases } = createAdminClient();

  let session: {
    $id: string;
    patientId: string;
    therapistId: string;
    scheduledAt?: string;
    status?: string;
    cloudflareMeetingId?: string;
    recordingEnabled?: boolean;
  };
  try {
    session = (await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.sessions,
      sessionId
    )) as never;
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Resolve the therapist's auth user id (therapistId on the session is the
  // therapists-collection $id, not the auth $id).
  let therapistUserId: string | null = null;
  try {
    const therapistDoc = (await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.therapists,
      session.therapistId
    )) as unknown as { userId?: string };
    therapistUserId = therapistDoc.userId ?? null;
  } catch {
    /* fall through — caller may still be patient or admin */
  }

  const isPatient = session.patientId === user.$id;
  const isTherapist = therapistUserId !== null && therapistUserId === user.$id;
  const isAdmin = user.labels?.includes("admin") ?? false;

  if (!isPatient && !isTherapist && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Lazy-create the meeting if this session predates the migration. Persist it
  // back so the next join doesn't recreate.
  let meetingId = session.cloudflareMeetingId;
  if (!meetingId) {
    try {
      const meeting = await createMeeting({
        title: `Therapy session ${session.$id}`,
        recordOnStart: session.recordingEnabled ?? false,
      });
      meetingId = meeting.id;
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.collections.sessions,
        session.$id,
        { cloudflareMeetingId: meetingId }
      );
    } catch (err) {
      console.error("join-token: failed to lazy-create meeting", err);
      return NextResponse.json(
        { error: "Could not provision the video meeting. Please retry." },
        { status: 502 }
      );
    }
  }

  const preset: ParticipantPreset = isPatient ? "group_call_participant" : "group_call_host";
  const role: "client" | "therapist" | "admin" = isPatient
    ? "client"
    : isTherapist
      ? "therapist"
      : "admin";

  try {
    const participant = await addParticipant({
      meetingId,
      name: user.name ?? user.email ?? "Participant",
      preset,
      customParticipantId: user.$id,
    });
    return NextResponse.json({
      token: participant.token,
      meetingId,
      role,
      recordingEnabled: session.recordingEnabled ?? false,
    });
  } catch (err) {
    console.error("join-token: addParticipant failed", err);
    return NextResponse.json(
      { error: "Could not issue join token. Please retry." },
      { status: 502 }
    );
  }
}
