"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Paperclip, Mic, CheckCheck, Check } from "lucide-react";
import { listDirectMessagesAction, sendMessageAction } from "@/app/actions/database";
import type { Message } from "@/lib/appwrite/database";
import { appwriteConfig } from "@/lib/appwrite/config";
import client from "@/lib/appwrite/client";
import { PLACEHOLDER_THERAPIST_ID } from "@/lib/constants";
import { useUser } from "@/app/components/UserProvider";

const MESSAGES_CHANNEL = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.messages}.documents`;
const THERAPIST_ID = PLACEHOLDER_THERAPIST_ID;

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function msgTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function msgDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yd = new Date(now); yd.setDate(now.getDate() - 1);
  if (d.toDateString() === yd.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addOrReplace(list: Message[], doc: Message): Message[] {
  const idx = list.findIndex((m) => m.$id === doc.$id);
  if (idx === -1) return [...list, doc];
  const copy = [...list]; copy[idx] = doc; return copy;
}

function replaceMsg(doc: Message) {
  return (prev: Message[]) => prev.map((m) => (m.$id === doc.$id ? doc : m));
}

function removeMsg(id: string) {
  return (prev: Message[]) => prev.filter((m) => m.$id !== id);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const user = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft]     = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  // Keep userId in a ref so the realtime callback always has a fresh value
  const userIdRef = useRef<string | null>(null);

  // ── Auth + initial message load ──────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        userIdRef.current = user.$id;
        const msgs = await listDirectMessagesAction(user.$id, THERAPIST_ID);
        setMessages(msgs);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Realtime subscription (separate effect to keep nesting shallow) ──────
  useEffect(() => {
    function onRealtimeEvent(evt: any) {
      const doc = evt.payload as unknown as Message;
      const uid = userIdRef.current;
      if (!uid) return;
      const mine = doc.senderId === uid || doc.receiverId === uid;
      const theirSide = doc.senderId === THERAPIST_ID || doc.receiverId === THERAPIST_ID;
      if (!mine || !theirSide) return;

      if (evt.events.some((e: string) => e.endsWith(".create"))) {
        setMessages((prev) => addOrReplace(prev, doc));
      } else if (evt.events.some((e: string) => e.endsWith(".update"))) {
        setMessages(replaceMsg(doc));
      } else if (evt.events.some((e: string) => e.endsWith(".delete"))) {
        setMessages(removeMsg(doc.$id));
      }
    }

    const unsub = client.subscribe(MESSAGES_CHANNEL, onRealtimeEvent);
    return unsub;
  }, []);

  // ── Scroll to bottom ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !user || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendMessageAction({
        sessionId: "direct",
        senderId: user.$id,
        receiverId: THERAPIST_ID,
        content: text,
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, user, sending]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  // Group messages by date label
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const label = msgDate(msg.createdAt);
    const last = grouped.at(-1);
    if (last?.date === label) last.msgs.push(msg);
    else grouped.push({ date: label, msgs: [msg] });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px)] lg:h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-brand/10 px-5 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center text-brand font-bold text-lg">
          T
        </div>
        <div>
          <p className="text-sm font-bold text-brand">Your Therapist</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-brand/40">Online · live updates active</span>
          </div>
        </div>
        <div className="ml-auto text-xs text-brand/35 bg-cream px-3 py-1.5 rounded-full">🔒 Encrypted</div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-cream/40">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-brand/8 flex items-center justify-center mb-3">
              <Send size={22} className="text-brand/30" />
            </div>
            <p className="text-sm font-semibold text-brand/50">Start the conversation</p>
            <p className="text-xs text-brand/35 mt-1 max-w-xs">Messages are private and delivered in real-time.</p>
          </div>
        ) : (
          grouped.map(({ date, msgs }) => (
            <div key={date}>
              <div className="flex justify-center my-4">
                <span className="text-xs text-brand/30 bg-cream/80 px-3 py-1 rounded-full border border-brand/8">{date}</span>
              </div>
              {msgs.map((msg) => {
                const mine = msg.senderId === user?.$id;
                return (
                  <div key={msg.$id} className={`flex mb-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${mine ? "bg-brand text-white rounded-br-sm" : "bg-white text-brand border border-brand/8 rounded-bl-sm"}`}>
                      <p>{msg.content}</p>
                      <div className={`flex items-center gap-1 mt-1 ${mine ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] ${mine ? "text-white/50" : "text-brand/30"}`}>{msgTime(msg.createdAt)}</span>
                        {mine ? <CheckCheck size={11} className="text-white/50" /> : <Check size={11} className="text-brand/25" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-brand/10 px-4 py-3">
        <div className="flex items-end gap-2">
          <button className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center hover:bg-brand/10 transition-colors shrink-0" aria-label="Attach file">
            <Paperclip size={15} className="text-brand/50" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-cream flex items-center justify-center hover:bg-brand/10 transition-colors shrink-0" aria-label="Voice note">
            <Mic size={15} className="text-brand/50" />
          </button>
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Message your therapist… (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-cream rounded-2xl px-4 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/20 max-h-32 overflow-y-auto"
          />
          <button
            onClick={() => void handleSend()}
            disabled={!draft.trim() || sending}
            aria-label="Send"
            className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
