"use client";

import { useEffect, useRef, useState, use } from "react";
import { databases, realtime } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query } from "appwrite";
import { Send, ArrowLeft, Loader2, User } from "lucide-react";
import Link from "next/link";

interface ChatMessage {
  $id: string;
  role: "user" | "bot" | "admin" | "system";
  text: string;
  sessionId: string;
  $createdAt: string;
}

interface ChatSession {
  name: string;
  email: string;
  sessionId: string;
}

export default function ChatSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<ChatSession | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchSessionData = async () => {
    try {
      // Fetch session info
      const sessionRes = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.chatSessions,
        [Query.equal("sessionId", [sessionId])]
      );
      if (sessionRes.total > 0) {
        setSession(sessionRes.documents[0] as unknown as ChatSession);
      }

      // Fetch messages
      const messagesRes = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.chatMessages,
        [
          Query.equal("sessionId", [sessionId]),
          Query.orderAsc("$createdAt"),
          Query.limit(100),
        ]
      );
      setMessages(messagesRes.documents as unknown as ChatMessage[]);
    } catch (error: any) {
      if (error?.code === 404) {
        setMessages([]);
      } else {
        console.error("Error fetching chat data:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();

    // Fallback polling every 5s
    const interval = setInterval(fetchSessionData, 5000);

    let unsubscribe: any;

    try {
      unsubscribe = realtime.subscribe(
        [`databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.chatMessages}.documents`],
        (response) => {
          if (response.events.includes("databases.*.collections.*.documents.*.create")) {
            const payload = response.payload as ChatMessage;
            if (payload.sessionId === sessionId) {
              setMessages((prev) => {
                if (prev.find((m) => m.$id === payload.$id)) return prev;
                return [...prev, payload];
              });
            }
          }
        }
      );
    } catch (error) {
      console.error("Realtime subscription error:", error);
    }

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      else if (unsubscribe?.unsubscribe) unsubscribe.unsubscribe();
      clearInterval(interval);
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !session || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    try {
      await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          text,
          userEmail: session.email,
          userName: session.name,
        }),
      });
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-stone-800">Session not found</h2>
        <Link href="/admin/customer-care" className="text-teal-600 hover:underline mt-4 inline-block">
          Go back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/customer-care"
            className="p-2 hover:bg-stone-200/50 rounded-full transition-colors text-stone-500"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
              {session.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-stone-900 leading-tight">{session.name}</h3>
              <p className="text-xs text-stone-500">{session.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-stone-50/30">
        {messages.filter(m => m.role !== 'system').map((msg) => (
          <div
            key={msg.$id}
            className={`flex ${msg.role === "admin" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm
                ${msg.role === "admin"
                  ? "bg-teal-600 text-white rounded-tr-sm"
                  : "bg-white text-stone-800 border border-stone-200 rounded-tl-sm"
                }`}
            >
              {msg.text}
              <div className={`text-[10px] mt-1.5 opacity-60 ${msg.role === 'admin' ? 'text-teal-50' : 'text-stone-400'}`}>
                {new Date(msg.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-stone-100 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your reply..."
          className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-teal-600 text-white p-3 rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md shadow-teal-600/10"
        >
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </form>
    </div>
  );
}
