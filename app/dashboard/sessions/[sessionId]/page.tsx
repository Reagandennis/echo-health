"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Video, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/app/components/UserProvider";
import VideoRoom from "@/app/components/video/VideoRoom";
import { getSessionAction } from "@/app/actions/database";
import type { TherapySession } from "@/lib/appwrite/database";
import posthog from "posthog-js";

export default function ClientSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const user = useUser();
  const router = useRouter();

  const [session, setSession] = useState<TherapySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const sess = (await getSessionAction(sessionId)) as TherapySession;

        // Access control — only the patient this session belongs to may enter
        if (sess.patientId !== user.$id) {
          setDenied(true);
          setLoading(false);
          return;
        }

        // Guard: session must not be cancelled/completed
        if (sess.status === "cancelled" || sess.status === "completed") {
          router.replace("/dashboard/sessions");
          return;
        }

        setSession(sess);
        posthog.capture("video_session_opened", {
          session_id: sess.$id,
          scheduled_at: sess.scheduledAt,
        });
      } catch (err) {
        console.error("Client session page error:", err);
        router.replace("/dashboard/sessions");
      } finally {
        setLoading(false);
      }
    })();
  }, [user, sessionId, router]);

  // ── Access denied ──────────────────────────────────────────────────────────
  if (denied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
          <ShieldAlert size={26} className="text-red-500" />
        </div>
        <p className="text-base font-bold text-stone-800">Access denied</p>
        <p className="text-sm text-stone-500 max-w-xs">You don&apos;t have permission to access this session.</p>
        <Link href="/dashboard/sessions" className="mt-2 text-sm font-semibold text-brand hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const { scheduledAt } = session;
  const formatted = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link href="/dashboard/sessions" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-brand transition-colors">
        <ArrowLeft size={14} /> All sessions
      </Link>

      {/* Session header */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
            <Video size={16} className="text-brand" />
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-900">Video Session</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock size={11} className="text-stone-400" />
              <span className="text-xs text-stone-500">{formatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Video area — Realtime Kit handles the "waiting for other participant"
          state inside the rtk-meeting UI, so we no longer gate this on the
          therapist's presence. */}
      <VideoRoom
        sessionId={session.$id}
        onLeave={() => router.replace("/dashboard/sessions")}
      />
    </div>
  );
}
