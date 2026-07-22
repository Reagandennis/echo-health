import { useState, useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";
import { createVideoSessionAction } from "@/app/actions/database";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

interface UseVideoSessionProps {
  sessionId: string;
  // Accepted for callsite compatibility but unused — the session-minting server
  // action resolves and authorizes the user from the cookie.
  userId?: string;
  role: "client" | "therapist";
}

/**
 * 1:1 video over the Echo video backend (video.echopsychology.com).
 *
 * Replaces the Cloudflare Calls SFU + DB-based track signaling. This service is
 * pure peer-to-peer: our server mints a per-participant session (see
 * `createVideoSessionAction`), the browser opens a signaling WebSocket, and the
 * two browsers exchange SDP/ICE directly. The server only relays setup — media
 * never touches it.
 *
 * Wire protocol (server → us): `role` (always first, carries our peerId + the
 * peers already present), `peer-joined`, `peer-left`, `full`. We send `offer` /
 * `answer` / `candidate`, always addressed with `to`. Roles: the FIRST human in
 * the room is `callee` and waits; the SECOND is `caller` and sends the offer.
 *
 * Two failure modes this guards against explicitly (both cause black video):
 *   1. Double-signal — a newcomer learns of each peer twice (in `role.peers`
 *      AND as `peer-joined`). `discoverPeer` is idempotent per peerId so we
 *      never negotiate the same peer twice.
 *   2. Early candidates — trickle ICE can arrive before the offer/answer it
 *      belongs to. `addIceCandidate` before `setRemoteDescription` throws and
 *      loses the candidate, so we buffer per peer and flush after the remote
 *      description is set.
 */

interface PeerInfo {
  peerId: string;
  kind: string;
  role: string;
}

type SignalIn =
  | { type: "role"; role: "caller" | "callee" | "recorder"; peerId: string; kind: string; peers: PeerInfo[] }
  | { type: "peer-joined"; peerId: string; kind: string; role: string }
  | { type: "peer-left"; peerId: string }
  | { type: "full" }
  | { type: "offer"; from: string; to?: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to?: string; sdp: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to?: string; candidate: RTCIceCandidateInit };

export function useVideoSession({ sessionId, role }: UseVideoSessionProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const myPeerIdRef = useRef<string | null>(null);
  const myRoleRef = useRef<"caller" | "callee" | "recorder" | null>(null);
  const remotePeerIdRef = useRef<string | null>(null);
  // Idempotent peer discovery (guard #1).
  const knownPeersRef = useRef<Set<string>>(new Set());
  // Per-peer trickle-ICE buffer (guard #2).
  const candidateBufferRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Guards against React 19 StrictMode double-mount calling joinSession twice.
  const joiningRef = useRef(false);

  const send = (msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    // Text frames only — the backend silently ignores binary.
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  const leaveSession = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    remoteStreamRef.current = null;
    myPeerIdRef.current = null;
    myRoleRef.current = null;
    remotePeerIdRef.current = null;
    knownPeersRef.current.clear();
    candidateBufferRef.current.clear();
    joiningRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsJoined(false);
  }, []);

  // Stable ref so unmount cleanup always calls the latest leaveSession without
  // re-running the effect on every render.
  const leaveSessionRef = useRef(leaveSession);
  useEffect(() => {
    leaveSessionRef.current = leaveSession;
  }, [leaveSession]);

  const joinSession = useCallback(async () => {
    if (joiningRef.current) return;
    joiningRef.current = true;
    setError(null);

    // Anchor for time-to-connect. Taken before getUserMedia, because the device
    // permission prompt is part of what makes joining a call slow.
    const joinStartedAt = Date.now();
    posthog.capture(ANALYTICS_EVENTS.VIDEO_ROOM_OPENED, { role });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Mint a session authorized to this therapy session; the API key stays
      // server-side. Returns the signaling URL (short-lived token embedded) and
      // the ICE servers (incl. ephemeral TURN creds).
      const { wsUrl, iceServers } = await createVideoSessionAction(sessionId, role);

      const pc = new RTCPeerConnection({
        iceServers: iceServers as RTCIceServer[],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      // Publish local media up front (send+recv), so ONE offer/answer exchange
      // negotiates both directions — no renegotiation needed for a 1:1 call.
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        // True P2P groups the remote media into event.streams[0]. Fall back to
        // accumulating individual tracks if it is ever absent.
        const inbound = event.streams[0];
        if (inbound) {
          remoteStreamRef.current = inbound;
          setRemoteStream(inbound);
          return;
        }
        if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
        remoteStreamRef.current.addTrack(event.track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
      };

      pc.onicecandidate = (event) => {
        const to = remotePeerIdRef.current;
        // Always address candidates: once a recorder joins there are 2+ peers
        // and an untargeted message is dropped, not broadcast.
        if (event.candidate && to) {
          send({
            type: "candidate",
            to,
            from: myPeerIdRef.current,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        /*
         * Call quality is the platform's core product metric: a therapy session
         * that fails to connect is a cancelled appointment, and until now
         * nothing measured it. `video_session_joined` fired when the user opened
         * the room, which counts intent to call, not a working call — the two
         * diverge in exactly the cases worth knowing about.
         *
         * `role` and `sessionId` are deliberately absent from the payload. The
         * therapy session id is a clinical record identifier; time-to-connect
         * and the ICE outcome are what diagnose a bad call.
         */
        if (pc.connectionState === "connected") {
          posthog.capture(ANALYTICS_EVENTS.VIDEO_CONNECTED, {
            seconds_to_connect: Math.round((Date.now() - joinStartedAt) / 1000),
          });
        }
        if (pc.connectionState === "failed") {
          setError("The call connection dropped. Try rejoining.");
          posthog.capture(ANALYTICS_EVENTS.VIDEO_FAILED, {
            reason: "peer_connection_failed",
            ice_connection_state: pc.iceConnectionState,
            seconds_since_join: Math.round((Date.now() - joinStartedAt) / 1000),
          });
        }
      };

      // ── Signaling handlers (close over this pc/ws; refs keep them current) ──
      const flushCandidates = async (peerId: string) => {
        const buffered = candidateBufferRef.current.get(peerId);
        if (!buffered) return;
        candidateBufferRef.current.delete(peerId);
        for (const c of buffered) {
          try {
            await pc.addIceCandidate(c);
          } catch (e) {
            console.error("addIceCandidate (buffered) failed:", e);
          }
        }
      };

      const makeOffer = async (peerId: string) => {
        remotePeerIdRef.current = peerId;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "offer", to: peerId, from: myPeerIdRef.current, sdp: pc.localDescription });
      };

      // Idempotent (guard #1): never negotiate a peer twice.
      const discoverPeer = async (peer: { peerId: string; kind?: string }) => {
        if (peer.kind === "recorder") return; // recording is a separate feature
        if (knownPeersRef.current.has(peer.peerId)) return;
        knownPeersRef.current.add(peer.peerId);
        remotePeerIdRef.current = peer.peerId;
        // Only the 'caller' (second human in) offers; the 'callee' waits.
        if (myRoleRef.current === "caller") await makeOffer(peer.peerId);
      };

      const handleOffer = async (msg: { from: string; sdp: RTCSessionDescriptionInit }) => {
        remotePeerIdRef.current = msg.from;
        await pc.setRemoteDescription(msg.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: "answer", to: msg.from, from: myPeerIdRef.current, sdp: pc.localDescription });
        await flushCandidates(msg.from);
      };

      const handleAnswer = async (msg: { from: string; sdp: RTCSessionDescriptionInit }) => {
        await pc.setRemoteDescription(msg.sdp);
        await flushCandidates(msg.from);
      };

      const handleCandidate = async (msg: { from: string; candidate: RTCIceCandidateInit }) => {
        // Buffer until the remote description exists (guard #2).
        if (pc.remoteDescription?.type) {
          try {
            await pc.addIceCandidate(msg.candidate);
          } catch (e) {
            console.error("addIceCandidate failed:", e);
          }
        } else {
          const buf = candidateBufferRef.current.get(msg.from) ?? [];
          buf.push(msg.candidate);
          candidateBufferRef.current.set(msg.from, buf);
        }
      };

      const handleSignal = async (msg: SignalIn) => {
        switch (msg.type) {
          case "role":
            myPeerIdRef.current = msg.peerId;
            myRoleRef.current = msg.role;
            setIsJoined(true); // we are in the room
            for (const p of msg.peers ?? []) await discoverPeer(p);
            break;
          case "peer-joined":
            await discoverPeer(msg);
            break;
          case "peer-left":
            if (msg.peerId === remotePeerIdRef.current) {
              remotePeerIdRef.current = null;
              knownPeersRef.current.delete(msg.peerId);
              remoteStreamRef.current = null;
              setRemoteStream(null); // VideoRoom shows "waiting…" again
            }
            break;
          case "full":
            setError("This session already has two participants.");
            leaveSessionRef.current();
            break;
          case "offer":
            await handleOffer(msg);
            break;
          case "answer":
            await handleAnswer(msg);
            break;
          case "candidate":
            await handleCandidate(msg);
            break;
        }
      };

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onmessage = (raw) => {
        let msg: SignalIn;
        try {
          msg = JSON.parse(raw.data) as SignalIn;
        } catch {
          return; // ignore malformed frames rather than tearing down
        }
        void handleSignal(msg);
      };
      ws.onerror = () => setError("Video connection error — check your network and retry.");
      ws.onclose = (ev) => {
        // Let the user retry from the UI after any close.
        joiningRef.current = false;
        // 1008 before we ever received a role = room full or bad/expired token.
        if (ev.code === 1008 && !myPeerIdRef.current) {
          setError("This session is full or the link has expired.");
          setIsJoined(false);
        }
      };
    } catch (err) {
      console.error("joinSession failed:", err);
      setError(err instanceof Error ? err.message : "Could not join session");
      // Tear down anything partially set up so the user can retry.
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      wsRef.current?.close();
      wsRef.current = null;
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
