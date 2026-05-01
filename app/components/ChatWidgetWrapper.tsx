"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { UserProvider } from "./UserProvider";
import type { Models } from "appwrite";

// Dynamically import the heavy ChatWidget (pulls in Appwrite realtime SDK)
// so it never blocks the critical rendering path.
const ChatWidget = dynamic(() => import("./ChatWidget"), {
  ssr: false,
  loading: () => null,
});

export default function ChatWidgetWrapper({
  user,
}: {
  user: Models.User<Models.Preferences> | null;
}) {
  const pathname = usePathname();
  if (pathname.startsWith("/therapist") || pathname.startsWith("/admin"))
    return null;

  return (
    <UserProvider user={user}>
      <ChatWidget />
    </UserProvider>
  );
}
