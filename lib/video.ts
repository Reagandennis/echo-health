/**
 * Server-side client for the Echo video backend (video.echopsychology.com).
 *
 * Replaces the Cloudflare Calls SFU proxy + Cloudflare TURN. This is a 1:1
 * *signaling* backend: our server mints a short-lived, per-participant session
 * token with the tenant API key; the browser then runs WebRTC peer-to-peer over
 * the returned WebSocket, and the server only relays call setup — it never sees
 * or stores media.
 *
 * SECURITY: `ECHO_VIDEO_API_KEY` (an `sk_live_…` tenant key that can mint
 * unlimited sessions) is read here and NEVER sent to the browser. It has no
 * `NEXT_PUBLIC_` prefix, so Next.js will not bundle it client-side even if this
 * module is imported by mistake. The browser receives only the wss URL (with an
 * embedded short-lived token) and the ICE servers.
 */

/**
 * Structural ICE-server type. Deliberately not the DOM's `RTCIceServer` so this
 * server module carries no dependency on the "dom" TS lib; it is structurally
 * compatible with what `new RTCPeerConnection({ iceServers })` expects.
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VideoSession {
  /** wss URL (short-lived token embedded) the browser opens for signaling. */
  wsUrl: string;
  /** ICE servers incl. ephemeral TURN creds, for the RTCPeerConnection. */
  iceServers: IceServer[];
  /** The room both participants share (= the therapy session id). */
  room: string;
  /** ISO timestamp after which the token can no longer be used to JOIN. */
  expiresAt: string;
}

function requireConfig() {
  const apiUrl = process.env.ECHO_VIDEO_API_URL;
  const apiKey = process.env.ECHO_VIDEO_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error(
      "Video service not configured — set ECHO_VIDEO_API_URL and ECHO_VIDEO_API_KEY"
    );
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

/**
 * Mint a session token for `room`, one per participant.
 *
 * Both the therapist and the client call this for the SAME room (the therapy
 * session id) and each receives their own token bound to that room — which is
 * how the backend puts two people in one call. Rooms are namespaced per tenant,
 * so a session id cannot collide with another business's rooms.
 */
export async function mintVideoSession(room: string): Promise<VideoSession> {
  const { apiUrl, apiKey } = requireConfig();

  const res = await fetch(`${apiUrl}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ room }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Do not surface the backend body verbatim to callers — it may echo request
    // detail. Log server-side, throw a terse message.
    const detail = await res.text().catch(() => "");
    console.error("Video session mint failed:", res.status, detail.slice(0, 300));
    throw new Error(`Could not start the video session (${res.status})`);
  }

  const data = (await res.json()) as {
    room: string;
    token: string;
    iceServers: IceServer[];
    expiresAt: string;
    /** Exact signaling path incl. token, e.g. "/ws?token=…". Preferred over
     *  reconstructing it ourselves so a backend path change can't break us. */
    wsPath?: string;
  };

  // https → wss, http → ws (for local/dev). The backend returns the exact
  // signaling path in `wsPath` (path + token query); use it when present, and
  // fall back to the documented shape for older backends that omit it.
  const wsBase = apiUrl.replace(/^http/, "ws");
  const wsUrl = data.wsPath
    ? data.wsPath.startsWith("ws")
      ? data.wsPath
      : `${wsBase}${data.wsPath}`
    : `${wsBase}/ws?token=${encodeURIComponent(data.token)}`;

  return {
    wsUrl,
    iceServers: data.iceServers ?? [],
    room: data.room,
    expiresAt: data.expiresAt,
  };
}
