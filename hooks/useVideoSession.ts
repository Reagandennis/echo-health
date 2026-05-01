import { useState, useEffect, useRef } from "react";
import appwriteClient, { databases } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";

interface UseVideoSessionProps {
  sessionId: string;
  userId: string;
  role: "client" | "therapist";
}

interface TrackInfo {
  location: "local" | "remote";
  mid: string;
  trackName: string;
  sessionId: string;
}

export function useVideoSession({ sessionId, userId, role }: UseVideoSessionProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const cfSessionId = useRef<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const callCloudflare = async (endpoint: string, data?: any) => {
    const res = await fetch("/api/video/session", {
      method: "POST",
      body: JSON.stringify({ endpoint, data }),
    });
    if (!res.ok) throw new Error(`Cloudflare API error: ${res.status}`);
    return res.json();
  };

  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, 
        audio: true 
      });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error("Failed to get local stream", err);
      return null;
    }
  };

  const joinSession = async () => {
    const stream = localStream || await initLocalStream();
    if (!stream) return;

    setIsJoined(true);
    
    // 1. Create Cloudflare Session
    const cfSession = await callCloudflare("/sessions/new");
    cfSessionId.current = cfSession.sessionId;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });
    pcRef.current = pc;

    // 2. Publish Local Tracks
    const transceivers = stream.getTracks().map(track => 
      pc.addTransceiver(track, { direction: "sendonly" })
    );

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const publishRes = await callCloudflare(`/sessions/${cfSession.sessionId}/tracks/new`, {
      sessionDescription: {
        type: "offer",
        sdp: offer.sdp,
      },
      tracks: transceivers.map(t => ({
        location: "local",
        mid: t.mid,
        trackName: t.sender.track?.kind,
      })),
    });

    await pc.setRemoteDescription(new RTCSessionDescription(publishRes.sessionDescription));

    // 3. Save published track IDs to Appwrite for signaling
    const trackData = JSON.stringify({
      cfSessionId: cfSession.sessionId,
      tracks: publishRes.tracks,
    });

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.sessions,
      sessionId,
      { [role === "therapist" ? "therapistTracks" : "patientTracks"]: trackData }
    );

    // 4. Handle incoming remote tracks
    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    // 5. Listen for the other participant's tracks
    const otherRole = role === "therapist" ? "patientTracks" : "therapistTracks";
    
    const checkOtherTracks = async (doc: any) => {
      const remoteTrackDataStr = doc[otherRole];
      if (!remoteTrackDataStr) return;

      const remoteTrackData = JSON.parse(remoteTrackDataStr);
      if (remoteTrackData.cfSessionId === cfSessionId.current) return; // ignore self

      // Request the tracks from Cloudflare
      const requestRes = await callCloudflare(`/sessions/${cfSession.sessionId}/tracks/request`, {
        tracks: remoteTrackData.tracks.map((t: any) => ({
          location: "remote",
          sessionId: remoteTrackData.cfSessionId,
          trackName: t.trackName,
        })),
      });

      await pc.setRemoteDescription(new RTCSessionDescription(requestRes.sessionDescription));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await callCloudflare(`/sessions/${cfSession.sessionId}/renegotiate`, {
        sessionDescription: {
          type: "answer",
          sdp: answer.sdp,
        },
      });
    };

    // Initial check
    const currentDoc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.collections.sessions,
      sessionId
    );
    await checkOtherTracks(currentDoc);

    // Realtime watch
    unsubscribeRef.current = appwriteClient.subscribe(
      `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.sessions}.documents.${sessionId}`,
      async (response: any) => {
        await checkOtherTracks(response.payload);
      }
    );
  };

  const leaveSession = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    unsubscribeRef.current?.();
    setIsJoined(false);
    setLocalStream(null);
    setRemoteStream(null);
    cfSessionId.current = null;
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  useEffect(() => {
    return () => leaveSession();
  }, []);

  return {
    localStream,
    remoteStream,
    isJoined,
    isAudioMuted,
    isVideoMuted,
    joinSession,
    leaveSession,
    toggleAudio,
    toggleVideo,
  };
}
