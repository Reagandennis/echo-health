"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * Lazy so the widget never blocks the critical path.
 *
 * (The original comment here said this "pulls in the Appwrite realtime SDK".
 * It has not since the auth migration — it pulls `hooks/useRealtime`, which is
 * SSE over Postgres LISTEN/NOTIFY. Kept lazy anyway: it is still the largest
 * component mounted on every public page.)
 */
const ChatWidget = dynamic(() => import("./ChatWidget"), {
  ssr: false,
  loading: () => null,
});

/**
 * Routes where a floating chat button is in the way rather than useful.
 *
 * `/therapist` and `/admin` are staff surfaces — they have their own support
 * routes and a visitor-facing widget there is just clutter.
 *
 * `/get-started` is the one that matters. The intake quiz renders full-width
 * option cards down the right edge of a phone screen, and the 56px FAB sits
 * directly on top of one of them — verified at 606px: the button covered the
 * third answer on question one. A conversion funnel whose answers you cannot
 * reliably tap is worse than one with no chat button.
 *
 * Prefix matching, so `/get-started?for=teen` is covered too.
 */
const HIDDEN_ON = ["/therapist", "/admin", "/get-started"];

export default function ChatWidgetWrapper() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((prefix) => pathname.startsWith(prefix))) return null;

  return <ChatWidget />;
}
