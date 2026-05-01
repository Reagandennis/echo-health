"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { realtime, databases } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query } from "appwrite";
import { useUser } from "./UserProvider";

interface ChatMessage {
  id: string;
  role: "user" | "bot" | "admin" | "system";
  text: string;
}

export default function ChatWidget() {
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const [stage, setStage] = useState<"gate" | "chat">("gate");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gateError, setGateError] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(typeof window !== 'undefined' ? (localStorage.getItem('chat_sessionId') || crypto.randomUUID()) : '');

  // Handle auto-gate for logged in users
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setStage("chat");
      fetchHistory();
    } else if (typeof window !== 'undefined' && sessionId.current) {
      localStorage.setItem('chat_sessionId', sessionId.current);
      const savedName = localStorage.getItem('chat_name');
      const savedEmail = localStorage.getItem('chat_email');
      if (savedName && savedEmail) {
        setName(savedName);
        setEmail(savedEmail);
        setStage('chat');
        fetchHistory();
      }
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      const res = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.collections.chatMessages,
        [Query.equal("sessionId", sessionId.current), Query.orderAsc("$createdAt")]
      );
      if (res.total > 0) {
        const history = res.documents.map((doc: any) => ({
          id: doc.$id,
          role: doc.role,
          text: doc.text,
        }));
        setMessages(history);
      }
    } catch (e: any) {
      if (e?.code !== 404) {
        console.error("History fetch error", e);
      }
    }
  };

  // Pulse every 12 s when closed so the user notices the widget
  useEffect(() => {
    const interval = setInterval(() => {
      if (!open) {
        setPulsing(true);
        setTimeout(() => setPulsing(false), 1800);
      }
    }, 12000);
    return () => clearInterval(interval);
  }, [open]);

  // Realtime subscription
  useEffect(() => {
    if (stage === 'chat') {
      let unsubscribe: any;
      
      try {
        unsubscribe = realtime.subscribe(
          [`databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.collections.chatMessages}.documents`],
          (response) => {
            const payload = response.payload as any;
            if (payload.sessionId === sessionId.current) {
              if (response.events.includes("databases.*.collections.*.documents.*.create")) {
                setMessages((prev) => {
                  if (prev.find(m => m.id === payload.$id)) return prev;
                  return [...prev, { id: payload.$id, role: payload.role, text: payload.text }];
                });
              }
            }
          }
        );
      } catch (e) {
        console.error("Realtime subscription error", e);
      }

      // Heartbeat to keep session online
      const heartbeat = setInterval(async () => {
        if (!name || !email) return;
        try {
          await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionId.current,
              name: name.trim(),
              email: email.trim(),
              role: "system",
              text: "heartbeat",
            }),
          });
        } catch (e) {}
      }, 30000);

      const handleUnload = () => {
        navigator.sendBeacon("/api/chat/offline", JSON.stringify({ sessionId: sessionId.current }));
      };
      window.addEventListener('beforeunload', handleUnload);

      return () => {
        if (typeof unsubscribe === "function") {
          unsubscribe();
        }
        clearInterval(heartbeat);
        window.removeEventListener('beforeunload', handleUnload);
      };
    }
  }, [stage, name, email]);

  // Scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleGateSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setGateError("");
    if (!name.trim() || !email.trim()) {
      setGateError("Please enter your name and email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGateError("Please enter a valid email address.");
      return;
    }
    setGateLoading(true);
    try {
      localStorage.setItem('chat_name', name.trim());
      localStorage.setItem('chat_email', email.trim());
      
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          name: name.trim(),
          email: email.trim(),
          role: "system",
          text: `Chat started by ${name.trim()} (${email.trim()})`,
        }),
      });
      setStage("chat");
      setMessages((prev) => prev.length > 0 ? prev : [
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: `Hi ${name.trim()} 👋 Welcome to Echo Health support. How can we help you today?`,
        },
      ]);
    } catch {
      setGateError("Could not connect. Please try again.");
    } finally {
      setGateLoading(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setSendError(false);
    
    // Optimistic UI
    const tempId = crypto.randomUUID();
    setMessages((prev) => [...prev, { id: tempId, role: "user", text }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          name: name.trim(),
          email: email.trim(),
          role: "user",
          text,
        }),
      });
      if (!res.ok) {
        setSendError(true);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      setSendError(true);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div
          className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-brand/10 flex flex-col overflow-hidden"
          style={{ maxHeight: "min(520px, calc(100vh - 120px))" }}
        >
          {/* Header */}
          <div className="bg-brand px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-tight">Echo Health</p>
                <p className="text-xs text-white/60 leading-tight">Support chat</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {stage === "gate" ? (
            <form onSubmit={handleGateSubmit} className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-sm font-semibold text-brand mb-1">Before we start</p>
                <p className="text-xs text-brand/50 leading-relaxed">
                  Please share your name and email so our team can follow up with you.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setGateError(""); }}
                  className="w-full rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-cream/40"
                />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setGateError(""); }}
                  className="w-full rounded-xl border border-brand/15 px-4 py-2.5 text-sm text-brand placeholder:text-brand/30 focus:outline-none focus:ring-2 focus:ring-brand/30 bg-cream/40"
                />
              </div>
              {gateError && <p className="text-red-500 text-xs">{gateError}</p>}
              <button
                type="submit"
                disabled={gateLoading}
                className="w-full bg-brand text-white text-sm font-semibold py-2.5 rounded-full hover:bg-brand/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {gateLoading && <Loader2 size={14} className="animate-spin" />}
                {gateLoading ? "Starting…" : "Start chat"}
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                        ${msg.role === "user"
                          ? "bg-brand text-white rounded-br-sm"
                          : "bg-cream text-brand rounded-bl-sm"
                        }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-cream rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand/50 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand/50 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand/50 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                {sendError && (
                  <div className="flex justify-center">
                    <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                      Message failed to send. Please try again.
                    </p>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-brand/8 px-4 py-3 flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend().catch(() => null);
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 text-sm text-brand placeholder:text-brand/30 bg-transparent outline-none"
                />
                <button
                  onClick={() => { handleSend().catch(() => null); }}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className="w-8 h-8 rounded-full bg-brand flex items-center justify-center hover:bg-brand/90 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send size={13} className="text-white" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open support chat"}
        className={`relative w-14 h-14 rounded-full bg-brand shadow-lg flex items-center justify-center
          transition-all duration-300 hover:scale-110 hover:shadow-xl hover:opacity-100
          ${open ? "opacity-100 scale-110" : "opacity-30"}
          ${pulsing && !open ? "animate-pulse" : ""}`}
      >
        {open
          ? <X size={22} className="text-white" />
          : <MessageCircle size={22} className="text-white" />
        }
        {!open && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
}
