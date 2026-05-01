"use client";

import { useEffect, useState } from "react";
import { Bell, X, Calendar, MessageCircle, AlertTriangle, Circle } from "lucide-react";
import { realtime } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { listNotificationsAction, markNotificationAsReadAction } from "@/app/actions/database";
import Link from "next/link";

interface Notification {
  $id: string;
  userId: string;
  title: string;
  message: string;
  type: "session" | "message" | "risk";
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchNotifications();

    // Subscribe to real-time changes
    const sub = realtime.subscribe(
      [`databases.${appwriteConfig.databaseId}.collections.notifications.documents`],
      (response) => {
        const payload = response.payload as Notification;
        if (payload.userId === userId) {
          if (response.events.includes("databases.*.collections.*.documents.*.create")) {
            setNotifications(prev => [payload, ...prev]);
          } else if (response.events.includes("databases.*.collections.*.documents.*.update")) {
            setNotifications(prev => prev.map(n => n.$id === payload.$id ? payload : n));
          } else if (response.events.includes("databases.*.collections.*.documents.*.delete")) {
            setNotifications(prev => prev.filter(n => n.$id !== payload.$id));
          }
        }
      }
    );

    return () => {
      if (typeof sub === "function") {
        (sub as () => void)();
      } else if (sub && "unsubscribe" in sub) {
        (sub as any).unsubscribe();
      }
    };
  }, [userId]);

  async function fetchNotifications() {
    try {
      const docs = await listNotificationsAction(userId);
      setNotifications(docs as unknown as Notification[]);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }

  async function markAsRead(id: string) {
    try {
      await markNotificationAsReadAction(id);
      setNotifications(prev => prev.map(n => n.$id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "session": return <Calendar size={14} className="text-blue-500" />;
      case "message": return <MessageCircle size={14} className="text-emerald-500" />;
      case "risk": return <AlertTriangle size={14} className="text-red-500" />;
      default: return <Bell size={14} className="text-stone-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-stone-500" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <span className="text-sm font-bold text-stone-900">Notifications</span>
              <button onClick={() => setIsOpen(false)}><X size={14} className="text-stone-400 hover:text-stone-600" /></button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell size={24} className="mx-auto text-stone-200 mb-2" />
                  <p className="text-xs text-stone-400">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.$id}
                    className={`px-4 py-3 border-b border-stone-50 hover:bg-stone-50 transition-colors flex gap-3 items-start relative ${!n.read ? "bg-brand/5" : ""}`}
                    onClick={() => !n.read && markAsRead(n.$id)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white border border-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold text-stone-900 ${!n.read ? "pr-3" : ""}`}>{n.title}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[9px] text-stone-300 mt-1">{new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {!n.read && (
                      <Circle size={8} className="text-brand fill-brand absolute top-4 right-4" />
                    )}
                    {n.link && (
                      <Link href={n.link} className="absolute inset-0" onClick={() => setIsOpen(false)} />
                    )}
                  </div>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-stone-100 bg-stone-50/50 text-center">
                <button className="text-[10px] font-bold text-brand hover:underline">Mark all as read</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
