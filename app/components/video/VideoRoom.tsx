"use client";

import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { useVideoSession } from "@/hooks/useVideoSession";

interface VideoRoomProps {
  sessionId: string;
  userId: string;
  role: "client" | "therapist";
  onLeave?: () => void;
}

export default function VideoRoom({ sessionId, userId, role, onLeave }: VideoRoomProps) {
  const {
    localStream,
    remoteStream,
    isJoined,
    isAudioMuted,
    isVideoMuted,
    joinSession,
    leaveSession,
    toggleAudio,
    toggleVideo,
  } = useVideoSession({ sessionId, userId, role });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Auto-join on mount
  useEffect(() => {
    if (!isJoined) {
      joinSession();
    }
  }, [joinSession, isJoined]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleLeave = () => {
    leaveSession();
    onLeave?.();
  };

  if (!isJoined) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-stone-900 rounded-3xl overflow-hidden relative">
        {localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="text-stone-400">Camera not enabled</div>
        )}
        
        <div className="relative z-10 flex flex-col items-center p-8 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">
          <h2 className="text-white font-semibold mb-4 text-lg">Ready to join?</h2>
          <button
            onClick={joinSession}
            className="px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20"
          >
            Join Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[600px] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-800">
      {/* Remote Video (Full Screen) */}
      {remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center flex-col text-stone-500">
          <div className="w-16 h-16 rounded-full border-4 border-stone-800 border-t-brand animate-spin mb-4" />
          <p>Waiting for the other person to join...</p>
        </div>
      )}

      {/* Local Video (PiP) */}
      <div className="absolute top-6 right-6 w-48 h-72 bg-stone-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-700 z-10">
        {localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover transform -scale-x-100"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-500">
            <VideoOff size={24} />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-xl p-3 rounded-full border border-white/10 z-20 shadow-2xl">
        <button
          onClick={toggleAudio}
          className={`p-4 rounded-full transition-all ${
            isAudioMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all ${
            isVideoMuted ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" : "bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
        </button>

        <div className="w-px h-8 bg-white/10 mx-2" />

        <button
          onClick={handleLeave}
          className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg shadow-red-500/20 transition-all"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {/* Badges */}
      <div className="absolute top-6 left-6 flex gap-2 z-10">
        <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 text-white text-xs font-semibold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          LIVE
        </div>
        <div className="px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg border border-white/10 text-white/80 text-xs font-medium">
          Secure End-to-End Encrypted
        </div>
      </div>
    </div>
  );
}
