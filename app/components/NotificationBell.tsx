"use client";

import { useEffect, useState } from "react";
import { Bell, X, Calendar, MessageCircle, AlertTriangle } from "lucide-react";
import { useRealtime } from "@/hooks/useRealtime";
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
  }, [userId]);

  // Realtime events carry no row contents, so the create/update/delete splicing
  // this used to do from `response.payload` is now a refetch. The action is
  // already scoped to the caller, which replaces the old `payload.userId` check.
  useRealtime(["notifications"], () => { fetchNotifications(); }, { enabled: !!userId });

  async function fetchNotifications() {
    try {
      const docs = await listNotificationsAction();
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

  /**
   * This button used to render with no handler at all. There is no bulk action,
   * so it marks each unread notification individually — at most 20, the
   * action's page size — and only flips the ones that actually succeeded.
   */
  async function markAllAsRead() {
    const unread = notifications.filter(n => !n.read);
    const results = await Promise.allSettled(unread.map(n => markNotificationAsReadAction(n.$id)));
    const done = new Set(unread.filter((_, i) => results[i].status === "fulfilled").map(n => n.$id));
    if (done.size < unread.length) console.error("Failed to mark some notifications as read");
    setNotifications(prev => prev.map(n => done.has(n.$id) ? { ...n, read: true } : n));
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "session": return <Calendar size={14} className="text-brand-600" />;
      case "message": return <MessageCircle size={14} className="text-emerald-600" />;
      case "risk": return <AlertTriangle size={14} className="text-rose-600" />;
      default: return <Bell size={14} className="text-stone-400" />;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-stone-200 motion-safe:animate-fade-in">
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
              <span className="text-sm font-semibold text-stone-900">Notifications</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
                className="rounded-md p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
              >
                <X size={14} />
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
                    <Bell size={18} className="text-stone-400" />
                  </div>
                  <p className="text-sm font-medium text-stone-700">You&apos;re all caught up</p>
                  <p className="mt-0.5 text-xs text-stone-500">New notifications will appear here.</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.$id}
                    className={`relative flex items-start gap-3 border-b border-stone-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-stone-50 ${!n.read ? "bg-brand-50/60" : ""}`}
                    onClick={() => !n.read && markAsRead(n.$id)}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-stone-200">
                      {getIcon(n.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-semibold text-stone-900 ${!n.read ? "pr-4" : ""}`}>{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-stone-600">{n.message}</p>
                      <p className="mt-1 text-[11px] text-stone-400">{new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    {!n.read && (
                      <span aria-label="Unread" className="absolute right-4 top-4 h-2 w-2 rounded-full bg-brand-500" />
                    )}
                    {n.link && (
                      <Link href={n.link} className="absolute inset-0" onClick={() => setIsOpen(false)} aria-label={n.title} />
                    )}
                  </div>
                ))
              )}
            </div>
            {unreadCount > 0 && (
              <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-2 text-center">
                <button type="button" onClick={markAllAsRead} className="text-xs font-semibold text-brand-700 hover:underline">
                  Mark all as read
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
