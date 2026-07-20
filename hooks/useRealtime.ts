"use client";

import { useEffect, useRef } from "react";

export interface ChangeEvent {
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string | null;
  audience: string[];
}

/**
 * Subscribe to realtime row changes. Replaces `appwriteClient.subscribe(...)`.
 *
 * Events carry identifiers only — never row contents — so the handler's job is
 * to refetch through the normal Server Actions, which enforce authorization.
 * That is deliberate: it means this channel cannot deliver data the viewer is
 * not entitled to, regardless of how the audience was computed server-side.
 *
 * @param tables  Table names to react to, e.g. ["messages"]. Empty = all.
 * @param onChange Invoked per matching event. Kept in a ref so a new inline
 *                 closure on every render does not tear down the connection.
 * @param options.chatSession Opaque support-chat session id, for anonymous
 *                 visitors who have no Auth0 identity to subscribe by.
 * @param options.enabled Set false to hold off connecting (e.g. while the user
 *                 is still loading).
 */
export function useRealtime(
  tables: string[],
  onChange: (event: ChangeEvent) => void,
  options: { chatSession?: string; enabled?: boolean } = {}
) {
  const { chatSession, enabled = true } = options;

  const handlerRef = useRef(onChange);
  // Assigned in an effect, not during render: React 19 forbids mutating a ref
  // while rendering, and doing so breaks concurrent rendering guarantees.
  useEffect(() => {
    handlerRef.current = onChange;
  });

  // Serialised so the effect compares by value; a fresh array literal each
  // render would otherwise reconnect the EventSource on every render.
  const tableKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;

    const url = chatSession
      ? `/api/events?chatSession=${encodeURIComponent(chatSession)}`
      : "/api/events";

    // EventSource reconnects on its own after a drop, which matters because
    // Azure App Service and intervening proxies close idle connections.
    const source = new EventSource(url);
    const wanted = tableKey ? new Set(tableKey.split(",")) : null;

    source.addEventListener("change", (raw) => {
      try {
        const event = JSON.parse((raw as MessageEvent).data) as ChangeEvent;
        if (wanted && !wanted.has(event.table)) return;
        handlerRef.current(event);
      } catch {
        // Ignore malformed frames rather than killing the subscription.
      }
    });

    return () => source.close();
  }, [tableKey, chatSession, enabled]);
}
