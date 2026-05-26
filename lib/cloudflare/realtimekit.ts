/**
 * Cloudflare Realtime Kit — server-side REST wrapper.
 *
 * Realtime Kit is Cloudflare's managed meetings product (formerly Dyte). This
 * file talks to its REST API. The browser never touches these endpoints
 * directly — clients receive a short-lived participant `token` from
 * `addParticipant()` and use it via the `@cloudflare/realtimekit-react` SDK.
 *
 * Required env (server-only):
 *   CLOUDFLARE_ACCOUNT_ID            — Cloudflare account id (32-char hex)
 *   CLOUDFLARE_REALTIME_KIT_ID       — Realtime Kit instance id (UUID)
 *   CLOUDFLARE_REALTIME_KIT_API_TOKEN — token with `Realtime Kit:Edit` perm
 */

const BASE = "https://api.cloudflare.com/client/v4";

export interface RealtimeKitMeeting {
  id: string;
  title?: string | null;
  record_on_start: boolean;
  preferred_region?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RealtimeKitParticipant {
  id: string;
  meeting_id: string;
  name: string;
  picture?: string | null;
  custom_participant_id?: string | null;
  preset_name: string;
  token: string;
  created_at?: string;
}

export type ParticipantPreset =
  | "group_call_host"
  | "group_call_participant"
  | (string & {});

interface CfEnvelope<T> {
  success?: boolean;
  errors?: unknown[];
  messages?: unknown[];
  result?: T;
  data?: T;
}

function getConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const kitId = process.env.CLOUDFLARE_REALTIME_KIT_ID;
  const token = process.env.CLOUDFLARE_REALTIME_KIT_API_TOKEN;
  if (!accountId || !kitId || !token) {
    throw new Error(
      "Cloudflare Realtime Kit env not configured (CLOUDFLARE_ACCOUNT_ID, " +
        "CLOUDFLARE_REALTIME_KIT_ID, CLOUDFLARE_REALTIME_KIT_API_TOKEN)."
    );
  }
  return { accountId, kitId, token };
}

function kitUrl(path: string): string {
  const { accountId, kitId } = getConfig();
  return `${BASE}/accounts/${accountId}/realtime/kit/${kitId}${path}`;
}

async function cfFetch<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" | "PATCH" | "DELETE" }
): Promise<T> {
  const { token } = getConfig();
  const res = await fetch(kitUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: CfEnvelope<T> | T | null = null;
  try {
    body = text ? (JSON.parse(text) as CfEnvelope<T> | T) : null;
  } catch {
    // Non-JSON response — fall through to error path below.
  }

  if (!res.ok) {
    const errMsg =
      (body && typeof body === "object" && "errors" in body && Array.isArray(body.errors) && body.errors.length > 0
        ? JSON.stringify(body.errors)
        : text) || `Realtime Kit ${init.method} ${path} failed: ${res.status}`;
    throw new Error(`Realtime Kit error (${res.status}): ${errMsg}`);
  }

  // Cloudflare typically wraps in { success, result } but Realtime Kit responses
  // have also been seen unwrapped — handle both.
  if (body && typeof body === "object") {
    if ("result" in body && (body as CfEnvelope<T>).result !== undefined) {
      return (body as CfEnvelope<T>).result as T;
    }
    if ("data" in body && (body as CfEnvelope<T>).data !== undefined) {
      return (body as CfEnvelope<T>).data as T;
    }
  }
  return body as T;
}

/** Create a meeting. Returns the meeting id you store on the TherapySession. */
export async function createMeeting(opts: {
  title: string;
  recordOnStart?: boolean;
}): Promise<RealtimeKitMeeting> {
  return cfFetch<RealtimeKitMeeting>("/meetings", {
    method: "POST",
    body: JSON.stringify({
      title: opts.title,
      record_on_start: opts.recordOnStart ?? false,
    }),
  });
}

/** Toggle the `record_on_start` flag before participants join. */
export async function updateMeetingRecording(
  meetingId: string,
  recordOnStart: boolean
): Promise<RealtimeKitMeeting> {
  return cfFetch<RealtimeKitMeeting>(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({ record_on_start: recordOnStart }),
  });
}

/** Hard-delete a meeting. Useful when a TherapySession is cancelled. */
export async function deleteMeeting(meetingId: string): Promise<void> {
  await cfFetch<unknown>(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
  });
}

/**
 * Add a participant to a meeting. Returns a participant record including a
 * short-lived `token` — give that to the browser; never share the API key.
 */
export async function addParticipant(opts: {
  meetingId: string;
  name: string;
  preset: ParticipantPreset;
  customParticipantId: string;
  picture?: string;
}): Promise<RealtimeKitParticipant> {
  return cfFetch<RealtimeKitParticipant>(
    `/meetings/${encodeURIComponent(opts.meetingId)}/participants`,
    {
      method: "POST",
      body: JSON.stringify({
        name: opts.name,
        preset_name: opts.preset,
        custom_participant_id: opts.customParticipantId,
        picture: opts.picture,
      }),
    }
  );
}
