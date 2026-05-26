"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useRealtimeKitClient,
  RealtimeKitProvider,
} from "@cloudflare/realtimekit-react";

// Stencil web component <rtk-meeting> ships in @cloudflare/realtimekit-ui.
// Registering its custom elements is browser-only. We import the loader
// dynamically on mount so SSR / module evaluation doesn't try to touch the DOM.
function useRegisterUI() {
  useEffect(() => {
    let cancelled = false;
    void import("@cloudflare/realtimekit-ui/loader")
      .then((m) => {
        if (!cancelled) m.defineCustomElements();
      })
      .catch((err) => console.error("Failed to load realtimekit-ui", err));
    return () => {
      cancelled = true;
    };
  }, []);
}

// Tell TS that <rtk-meeting> is a valid custom element. The Stencil bindings
// expose JSX intrinsics in @cloudflare/realtimekit-ui/dist/types but pulling
// them in adds bundle weight; a minimal declaration is enough.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "rtk-meeting": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

interface JoinTokenResponse {
  token: string;
  meetingId: string;
  role: "client" | "therapist" | "admin";
  recordingEnabled: boolean;
}

interface VideoRoomProps {
  sessionId: string;
  onLeave?: () => void;
}

/**
 * Therapy-call surface backed by Cloudflare Realtime Kit. The browser never
 * receives the API token — instead it asks `/api/video/session/{id}/join-token`
 * for a per-participant `token`, which it hands to the SDK.
 */
export default function VideoRoom({ sessionId, onLeave }: VideoRoomProps) {
  useRegisterUI();
  const [meeting, initMeeting] = useRealtimeKitClient();
  const meetingElRef = useRef<HTMLElement | null>(null);
  const [info, setInfo] = useState<JoinTokenResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function joinSession() {
    setStatus("joining");
    setError(null);
    try {
      const res = await fetch(`/api/video/session/${sessionId}/join-token`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Token request failed: ${res.status}`);
      }
      const data = (await res.json()) as JoinTokenResponse;
      setInfo(data);
      await initMeeting({
        authToken: data.token,
        defaults: { audio: true, video: true },
      });
      setStatus("joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join session");
      setStatus("error");
    }
  }

  // Bind the meeting client onto the <rtk-meeting> element as a property
  // (Stencil components expect complex objects via DOM properties, not attrs).
  useEffect(() => {
    if (meetingElRef.current && meeting) {
      (meetingElRef.current as unknown as { meeting: unknown }).meeting = meeting;
    }
  }, [meeting]);

  // Surface room-leave events back to the caller so the parent page can mark
  // the session completed, etc.
  useEffect(() => {
    if (!meeting || !onLeave) return;
    const handleLeft = () => onLeave();
    // The SDK exposes the `self.on("roomLeft", ...)` event. We type-erase
    // because the public type uses an internal `RTKEventMap` we don't ship.
    const self = (meeting as unknown as { self: { on: (e: string, fn: () => void) => void; off: (e: string, fn: () => void) => void } }).self;
    self.on("roomLeft", handleLeft);
    return () => {
      self.off("roomLeft", handleLeft);
    };
  }, [meeting, onLeave]);

  if (status === "joining") {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-stone-900 rounded-3xl text-stone-300">
        <Loader2 className="w-8 h-8 animate-spin mb-3" />
        <p>Connecting…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-stone-900 rounded-3xl text-stone-200 p-8">
        <p className="text-red-300 text-sm text-center mb-4 max-w-md">{error}</p>
        <button
          onClick={joinSession}
          className="px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  if (status === "idle" || !meeting || !info) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-stone-900 rounded-3xl text-stone-300 p-8">
        <h2 className="text-white font-semibold mb-2 text-lg">Ready to join?</h2>
        <p className="text-xs text-stone-400 mb-4 text-center max-w-sm">
          We&apos;ll ask for camera + microphone access. The call is hosted on
          Cloudflare Realtime Kit.
        </p>
        <button
          onClick={joinSession}
          className="px-6 py-3 bg-brand text-white font-semibold rounded-xl hover:bg-brand/90 transition-all shadow-lg shadow-brand/20"
        >
          Join Session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {(info.role === "therapist" || info.role === "admin") && (
        <RecordingToggle
          sessionId={sessionId}
          initialEnabled={info.recordingEnabled}
        />
      )}
      <div className="h-[600px] bg-stone-900 rounded-3xl overflow-hidden shadow-2xl border border-stone-800">
        <RealtimeKitProvider
          value={meeting}
          fallback={
            <div className="h-full flex items-center justify-center text-stone-400">
              Loading meeting…
            </div>
          }
        >
          <rtk-meeting ref={meetingElRef} style={{ height: "100%", width: "100%", display: "block" }} />
        </RealtimeKitProvider>
      </div>
    </div>
  );
}

function RecordingToggle({
  sessionId,
  initialEnabled,
}: {
  sessionId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/video/session/${sessionId}/recording`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to update recording");
      }
      setEnabled(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not update recording");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
      <div className="text-xs text-amber-900">
        <p className="font-semibold mb-0.5">Recording</p>
        <p className="text-amber-800/80">
          {enabled
            ? "Recording will start when the call begins. You must have explicit patient consent — recordings are PHI."
            : "Recording is off. Toggle on (with patient consent) before joining."}
        </p>
        {err && <p className="text-red-600 mt-1">{err}</p>}
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => void toggle(e.target.checked)}
          className="w-4 h-4 accent-amber-600"
        />
        <span className="text-xs font-semibold text-amber-900">
          {saving ? "Saving…" : enabled ? "On" : "Off"}
        </span>
      </label>
    </div>
  );
}
