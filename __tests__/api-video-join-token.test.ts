/**
 * @jest-environment node
 */
import { createAdminClient, getLoggedInUser } from "@/lib/appwrite/server";
import { addParticipant, createMeeting } from "@/lib/cloudflare/realtimekit";

jest.mock("@/lib/appwrite/server", () => ({
  createAdminClient: jest.fn(),
  getLoggedInUser: jest.fn(),
}));

jest.mock("@/lib/cloudflare/realtimekit", () => ({
  addParticipant: jest.fn(),
  createMeeting: jest.fn(),
}));

const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockedGetLoggedInUser = getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>;
const mockedAddParticipant = addParticipant as jest.MockedFunction<typeof addParticipant>;
const mockedCreateMeeting = createMeeting as jest.MockedFunction<typeof createMeeting>;

function jsonRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: jest.fn((k: string) => headers[k.toLowerCase()] ?? null),
    },
  } as unknown as Request;
}

async function loadPost() {
  const mod = await import("@/app/api/video/session/[sessionId]/join-token/route");
  return mod.POST;
}

describe("/api/video/session/[sessionId]/join-token", () => {
  const databases = {
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateAdminClient.mockReturnValue({ databases } as unknown as ReturnType<typeof createAdminClient>);
    mockedAddParticipant.mockResolvedValue({
      id: "p_1",
      meeting_id: "m_1",
      name: "Ada",
      preset_name: "group_call_participant",
      token: "jwt-token-xxx",
    });
    mockedCreateMeeting.mockResolvedValue({
      id: "m_lazy",
      record_on_start: false,
    });
  });

  it("rejects unauthenticated callers", async () => {
    mockedGetLoggedInUser.mockResolvedValue(null);
    const POST = await loadPost();
    const res = await POST(jsonRequest(), { params: Promise.resolve({ sessionId: "s1" }) });
    expect(res.status).toBe(401);
  });

  it("forbids users not on the session", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "stranger", labels: [] });
    databases.getDocument
      .mockResolvedValueOnce({
        $id: "s1",
        patientId: "patient-1",
        therapistId: "therapist-doc-1",
        cloudflareMeetingId: "m_1",
        recordingEnabled: false,
      })
      .mockResolvedValueOnce({ userId: "therapist-user-1" });

    const POST = await loadPost();
    const res = await POST(jsonRequest(), { params: Promise.resolve({ sessionId: "s1" }) });
    expect(res.status).toBe(403);
  });

  it("issues a host token for the therapist", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "therapist-user-1", name: "Dr T", labels: [] });
    databases.getDocument
      .mockResolvedValueOnce({
        $id: "s1",
        patientId: "patient-1",
        therapistId: "therapist-doc-1",
        cloudflareMeetingId: "m_1",
        recordingEnabled: true,
      })
      .mockResolvedValueOnce({ userId: "therapist-user-1" });

    const POST = await loadPost();
    const res = await POST(jsonRequest(), { params: Promise.resolve({ sessionId: "s1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      token: "jwt-token-xxx",
      meetingId: "m_1",
      role: "therapist",
      recordingEnabled: true,
    });
    expect(mockedAddParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: "m_1",
        preset: "group_call_host",
        customParticipantId: "therapist-user-1",
      })
    );
  });

  it("issues a participant token for the patient and lazy-creates a meeting if missing", async () => {
    mockedGetLoggedInUser.mockResolvedValue({ $id: "patient-1", name: "Ada", labels: [] });
    databases.getDocument
      .mockResolvedValueOnce({
        $id: "s1",
        patientId: "patient-1",
        therapistId: "therapist-doc-1",
        // No cloudflareMeetingId -> route should lazy-create.
        recordingEnabled: false,
      })
      .mockResolvedValueOnce({ userId: "therapist-user-1" });
    databases.updateDocument.mockResolvedValue({});

    const POST = await loadPost();
    const res = await POST(jsonRequest(), { params: Promise.resolve({ sessionId: "s1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockedCreateMeeting).toHaveBeenCalledTimes(1);
    expect(databases.updateDocument).toHaveBeenCalled();
    const updateArgs = databases.updateDocument.mock.calls[0];
    expect(updateArgs[2]).toBe("s1");
    expect(updateArgs[3]).toEqual({ cloudflareMeetingId: "m_lazy" });
    expect(body.meetingId).toBe("m_lazy");
    expect(body.role).toBe("client");
    expect(mockedAddParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingId: "m_lazy",
        preset: "group_call_participant",
        customParticipantId: "patient-1",
      })
    );
  });
});
