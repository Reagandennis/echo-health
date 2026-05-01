"use client";

import { useEffect, useState } from "react";
import { databases, realtime } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query } from "appwrite";
import { MessageSquare, Clock, User, ChevronRight } from "lucide-react";
import Link from "next/link";

interface ChatSession {
  $id: string;
  sessionId: string;
  name: string;
  email: string;
  lastMessage: string;
  lastActive: string;
  isOnline: boolean;
}

export default function CustomerCarePage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      const response = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.chatSessions,
        [Query.orderDesc("lastActive")]
      );
      setSessions(response.documents as unknown as ChatSession[]);
    } catch (error: any) {
      // Handle missing collection gracefully
      if (error?.code === 404) {
        setSessions([]);
      } else {
        console.error("Error fetching sessions:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Fallback polling every 10s
    const interval = setInterval(fetchSessions, 10000);

    let unsubscribe: any;
    try {
      unsubscribe = realtime.subscribe(
        [`databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.chatSessions}.documents`],
        (response) => {
          const payload = response.payload as ChatSession;
          if (response.events.includes("databases.*.collections.*.documents.*.create")) {
            setSessions((prev) => [payload, ...prev]);
          } else if (response.events.includes("databases.*.collections.*.documents.*.update")) {
            setSessions((prev) =>
              prev.map((s) => (s.$id === payload.$id ? payload : s))
            );
          }
        }
      );
    } catch (error) {
      console.error("Failed to subscribe to sessions:", error);
    }

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      else if (unsubscribe?.unsubscribe) unsubscribe.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-stone-900">Customer Care</h2>
          <p className="text-stone-500">Manage all incoming support messages.</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Live Monitoring
        </div>
      </div>

      <div className="grid gap-4">
        {sessions.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-stone-200 text-center">
            <MessageSquare className="w-12 h-12 text-stone-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-stone-800">No active chats</h3>
            <p className="text-stone-500">Wait for customers to reach out via the chatbot.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.$id}
              href={`/admin/customer-care/${session.sessionId}`}
              className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:border-teal-300 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-lg">
                    {session.name.charAt(0)}
                  </div>
                  {session.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900">{session.name}</h3>
                    <span className="text-xs text-stone-400">•</span>
                    <span className="text-xs text-stone-500">{session.email}</span>
                  </div>
                  <p className="text-sm text-stone-600 line-clamp-1 mt-0.5">
                    {session.lastMessage || "No messages yet"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Clock size={12} />
                    {new Date(session.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <p className="text-[10px] text-stone-300 uppercase font-bold tracking-widest mt-1">
                    {session.isOnline ? "Active now" : "Offline"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
