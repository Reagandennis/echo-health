import { useState, useEffect, useRef, useCallback } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { updateSessionTracksAction, getSessionTracksAction } from "@/app/actions/database";

interface UseVideoSessionProps {
  sessionId: string;
  // userId is accepted for callsite compatibility but no longer needed —
  // the track-update server action resolves the authenticated user from the cookie.
  userId?: string;
  role: "client" | "therapist";
}

export function useVideoSession({ sessionId, role }: UseVideoSessionProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cfSessionId = useRef<string | null>(null);
  // Set once joinSession has a peer connection to renegotiate against. The
  // realtime subscription lives at the top level of the hook (rules of hooks)
  // but the handler it needs is built inside joinSession, so it is passed here.
  const checkOtherTracksRef = useRef<
    ((doc: Record<string, unknown>) => Promise<void>) | null
  >(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Accumulates pulled remote tracks. Cloudflare Calls delivers them on
  // separate ontrack events without grouping into event.streams, so we build
  // the remote MediaStream ourselves.
  const remoteStreamRef = useRef<MediaStream | null>(null);
  // joiningRef guards against React 19 StrictMode double-mount + repeated
  // VideoRoom effect firings calling joinSession() multiple times concurrently.
  const joiningRef = useRef(false);

  // `method` is the verb the server proxy should use against the Cloudflare
  // Calls API (the call to our own /api/video/session is always POST). Most
  // endpoints are POST; /renegotiate must be PUT.
  const callCloudflare = async (
    endpoint: string,
    data?: unknown,
    method: "GET" | "POST" | "PUT" = "POST"
  ) => {
    const res = await fetch("/api/video/session", {
      method: "POST",
      body: JSON.stringify({ endpoint, data, method }),
    });
    if (!res.ok) throw new Error(`Cloudflare API error: ${res.status}`);
    return res.json();
  };

  const leaveSession = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    checkOtherTracksRef.current = null;
    cfSessionId.current = null;
    joiningRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsJoined(false);
  }, []);

  // Stable ref so the unmount cleanup always calls the latest leaveSession
  // without re-running the effect on every render.
  const leaveSessionRef = useRef(leaveSession);
  useEffect(() => {
    leaveSessionRef.current = leaveSession;
  }, [leaveSession]);

  const joinSession = useCallback(async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 1. Create Cloudflare Session
      const cfSession = await callCloudflare("/sessions/new");
      cfSessionId.current = cfSession.sessionId;

      // Fetch short-lived TURN credentials so calls work behind symmetric NATs
      // and restrictive firewalls (STUN alone is not enough in those cases).
      const iceRes = await fetch("/api/video/ice-servers", { method: "POST" });
      if (!iceRes.ok) {
        throw new Error(`Failed to fetch ICE servers: ${iceRes.status}`);
      }
      const { iceServers } = (await iceRes.json()) as {
        iceServers: RTCIceServer[];
      };

      const pc = new RTCPeerConnection({
        iceServers,
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        // event.streams is empty for Cloudflare-pulled remote tracks, so add
        // each incoming track to our own stream. Hand React a fresh MediaStream
        // reference each time so the srcObject effect re-runs.
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      };

      // 2. Publish Local Tracks
      const transceivers = stream.getTracks().map((track) =>
        pc.addTransceiver(track, { direction: "sendonly" })
      );

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const publishRes = await callCloudflare(
        `/sessions/${cfSession.sessionId}/tracks/new`,
        {
          sessionDescription: { type: "offer", sdp: offer.sdp },
          tracks: transceivers.map((t) => ({
            location: "local",
            mid: t.mid,
            trackName: t.sender.track?.kind,
          })),
        }
      );

      await pc.setRemoteDescription(
        new RTCSessionDescription(publishRes.sessionDescription)
      );

      // 3. Persist track metadata via a server action — bypasses the session-doc
      // update ACL, which has historically granted update to Role.user(therapistDocId)
      // rather than Role.user(therapistUserId).
      const trackData = JSON.stringify({
        cfSessionId: cfSession.sessionId,
        tracks: publishRes.tracks,
      });

      await updateSessionTracksAction(sessionId, role, trackData);

      setIsJoined(true);

      // 4. Listen for the other participant's tracks
      const otherRole = role === "therapist" ? "patientTracks" : "therapistTracks";

      const checkOtherTracks = async (doc: Record<string, unknown>) => {
        const raw = doc[otherRole];
        if (!raw) return;

        // The column is `jsonb` now, so the action hands back a parsed object.
        // Appwrite stored a JSON string and rows written before the migration
        // may still be one, hence both are accepted.
        const remoteTrackData = (
          typeof raw === "string" ? JSON.parse(raw) : raw
        ) as { cfSessionId: string; tracks: { trackName: string }[] };
        if (remoteTrackData.cfSessionId === cfSessionId.current) return; // ignore self

        // Pull the remote participant's tracks. Cloudflare Calls has no
        // /tracks/request endpoint — remote tracks are pulled via /tracks/new
        // (with location: "remote"); the SFU replies with an offer we answer.
        const requestRes = await callCloudflare(
          `/sessions/${cfSession.sessionId}/tracks/new`,
          {
            tracks: remoteTrackData.tracks.map((t: { trackName: string }) => ({
              location: "remote",
              sessionId: remoteTrackData.cfSessionId,
              trackName: t.trackName,
            })),
          }
        );

        await pc.setRemoteDescription(
          new RTCSessionDescription(requestRes.sessionDescription)
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Renegotiate must be PUT (POST returns 405 from Cloudflare).
        await callCloudflare(
          `/sessions/${cfSession.sessionId}/renegotiate`,
          { sessionDescription: { type: "answer", sdp: answer.sdp } },
          "PUT"
        );
      };

      // Initial check — read the other party's already-published tracks via a
      // server action. The browser has no database session, so this is the only
      // way to read the row.
      const currentTracks = await getSessionTracksAction(sessionId, role);
      await checkOtherTracks(currentTracks as unknown as Record<string, unknown>);

      // Hand the handler to the realtime watch below, which is now live.
      checkOtherTracksRef.current = checkOtherTracks;
    } catch (err) {
      console.error("joinSession failed:", err);
      setError(err instanceof Error ? err.message : "Could not join session");
      // Tear down anything that may have been partially set up so the user can retry.
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      setLocalStream(null);
      joiningRef.current = false;
    }
  }, [sessionId, role]);

  /**
   * Watch for the other participant publishing their tracks.
   *
   * The Appwrite subscription this replaces handed the session document
   * straight to `checkOtherTracks` via `response.payload`. Events now carry
   * identifiers only, so the row is refetched through `getSessionTracksAction`
   * — which returns exactly the two track columns the handler reads, so no
   * signalling data is lost. Cloudflare SDP still flows over `/api/video/*`;
   * this channel only ever said "tracks changed, go look".
   *
   * KNOWN GAP: the `therapy_sessions` trigger addresses `therapist_id`, which
   * is a `therapists.id` row reference rather than the clinician's user id, and
   * `/api/events` subscribes by user id alone. Until that is resolved to a user
   * id, a therapist already waiting in the room will not be told when their
   * patient joins. The patient side is unaffected (`patient_id` is an Auth0
   * sub), and either side still pulls tracks published before they joined via
   * the initial `getSessionTracksAction` check above.
   */
  useRealtime(
    ["therapy_sessions"],
    (event) => {
      if (event.id !== sessionId) return;
      const check = checkOtherTracksRef.current;
      if (!check) return;
      (async () => {
        try {
          const tracks = await getSessionTracksAction(sessionId, role);
          await check(tracks as unknown as Record<string, unknown>);
        } catch (err) {
          console.error("Remote track check failed:", err);
        }
      })();
    },
    { enabled: isJoined }
  );

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  useEffect(() => {
    return () => leaveSessionRef.current();
  }, []);

  return {
    localStream,
    remoteStream,
    isJoined,
    isAudioMuted,
    isVideoMuted,
    error,
    joinSession,
    leaveSession,
    toggleAudio,
    toggleVideo,
  };
}
