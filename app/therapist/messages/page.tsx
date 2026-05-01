"use client";

import { useEffect, useRef, useState } from "react";
import appwriteClient from "@/lib/appwrite/client";
import { 
  listChatSessionsAction, 
  listChatMessagesAction, 
  getProfileByUserIdAction, 
  sendChatReplyAction 
} from "@/app/actions/database";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Send, MessageSquare, User, Search, AlertTriangle } from "lucide-react";

interface ChatSession { $id: string; userId: string; status: string; createdAt: string; }
interface ChatMessage { $id: string; sessionId: string; sender: string; body: string; createdAt: string; }
interface Profile { $id: string; name: string; }

export default function MessagesPage() {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [active, setActive] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const sessions = await listChatSessionsAction(50) as unknown as ChatSession[];
        setChatSessions(sessions);
        const userIds = [...new Set(sessions.map((s) => s.userId))];
        const pMap: Record<string, Profile> = {};
        await Promise.all(userIds.map(async (uid) => {
          try {
            const p = await getProfileByUserIdAction(uid);
            if (p) pMap[uid] = p as unknown as Profile;
          } catch { /* empty */ }
        }));
        setProfiles(pMap);
      } catch { /* empty */ }
    })();
  }, []);

  useEffect(() => {
    if (!active) return;
    (async () => {
      try {
        const msgs = await listChatMessagesAction(active.$id, 100);
        setMessages(msgs as unknown as ChatMessage[]);
      } catch { /* empty */ }
    })();

    const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.chatMessages}.documents`;
    const unsub = appwriteClient.subscribe(channel, (event: { payload: unknown }) => {
      const msg = event.payload as ChatMessage;
      if (msg.sessionId === active.$id) setMessages((prev) => [...prev, msg]);
    });
    return () => unsub();
  }, [active]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendReply() {
    if (!reply.trim() || !active) return;
    setSending(true);
    try {
      await sendChatReplyAction(active.$id, reply.trim());
      setReply("");
    } catch { /* empty */ }
    setSending(false);
  }

  const filteredSessions = chatSessions.filter((s) => {
    const name = profiles[s.userId]?.name ?? s.userId;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-6">Messages</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[70vh]">
        {/* Sidebar */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-stone-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-stone-200 text-xs outline-none focus:border-brand" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
            {filteredSessions.length === 0 && <div className="py-12 text-center text-xs text-stone-400">No conversations</div>}
            {filteredSessions.map((s) => (
              <button key={s.$id} onClick={() => setActive(s)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors ${active?.$id === s.$id ? "bg-brand/5 border-l-2 border-brand" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
                  {(profiles[s.userId]?.name ?? "U").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{profiles[s.userId]?.name ?? s.userId}</p>
                  <p className="text-xs text-stone-400">{s.status}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Thread */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col overflow-hidden">
          {active ? (
            <>
              <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-sm shrink-0">
                  {(profiles[active.userId]?.name ?? "U").charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-800">{profiles[active.userId]?.name ?? active.userId}</p>
                  <p className="text-xs text-stone-400 capitalize">{active.status}</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const isAdmin = m.sender === "admin";
                  return (
                    <div key={m.$id} className={`flex items-end gap-2 ${isAdmin ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isAdmin ? "bg-brand text-white" : "bg-stone-200 text-stone-600"}`}>
                        <User size={12} />
                      </div>
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? "bg-brand text-white rounded-br-sm" : "bg-stone-100 text-stone-800 rounded-bl-sm"}`}>
                        {m.body}
                      </div>
                      {m.body.toLowerCase().includes("suicid") && (
                        <span title="Risk indicator"><AlertTriangle size={14} className="text-red-500 shrink-0" /></span>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-4 border-t border-stone-100 flex gap-2">
                <input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                  placeholder="Type a reply…" className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" />
                <button onClick={() => void sendReply()} disabled={sending || !reply.trim()}
                  className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0">
                  <Send size={14} />
                </button>
              </div>
            </>) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-stone-400">
              <MessageSquare size={40} className="text-stone-200" />
              <p className="text-sm">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
