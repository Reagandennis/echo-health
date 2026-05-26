import { useState, useEffect, useRef, useCallback } from "react";
import appwriteClient from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
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
  const unsubscribeRef = useRef<(() => void) | null>(null);
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
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
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
        const remoteTrackDataStr = doc[otherRole] as string | undefined;
        if (!remoteTrackDataStr) return;

        const remoteTrackData = JSON.parse(remoteTrackDataStr);
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
      // server action. The browser Appwrite client has no session (httpOnly
      // cookie), so a direct getDocument here returns 404 under the session ACL.
      const currentTracks = await getSessionTracksAction(sessionId, role);
      await checkOtherTracks(currentTracks as unknown as Record<string, unknown>);

      // Realtime watch
      unsubscribeRef.current = appwriteClient.subscribe(
        `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.sessions}.documents.${sessionId}`,
        async (response: { payload: Record<string, unknown> }) => {
          await checkOtherTracks(response.payload);
        }
      );
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
