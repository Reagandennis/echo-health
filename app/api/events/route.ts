import { getLoggedInUser } from "@/lib/auth/session";
import { subscribe, type ChangeEvent } from "@/lib/db/events";

/**
 * Server-Sent Events stream — the browser-facing half of the realtime feed that
 * replaced Appwrite's `client.subscribe(...)`.
 *
 * Events carry identifiers only; the client refetches through normal
 * RLS-protected queries. That keeps this endpoint incapable of leaking row
 * contents even if an audience were computed wrongly.
 *
 * Requires the Node runtime and a long-lived process. On serverless the
 * function is frozen between invocations and the stream dies silently.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Azure App Service closes idle HTTP connections (~230s by default), and
 * intermediate proxies are often stricter. A comment line every 25s keeps the
 * connection classified as active. EventSource reconnects on its own if one is
 * dropped anyway, so this is an optimisation, not correctness.
 */
const HEARTBEAT_MS = 25_000;

export async function GET(request: Request) {
  const user = await getLoggedInUser();

  // Anonymous support-chat visitors have no Auth0 identity and subscribe by
  // their opaque chat session id instead.
  const chatSession = new URL(request.url).searchParams.get("chatSession");

  const tokens: string[] = [];
  if (user) tokens.push(user.$id);
  if (chatSession) tokens.push(chatSession);

  // Support-chat rows are addressed by the visitor's opaque session id, which no
  // staff member is ever a member of. Migration 0004 therefore also addresses a
  // constant "staff" token, so the admin inbox — which spans every conversation
  // and knows no single session id — has something to subscribe to.
  if (user && (user.labels.includes("admin") || user.labels.includes("therapist"))) {
    tokens.push("staff");
  }

  if (tokens.length === 0) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          // Client vanished mid-write; cleanup runs via cancel().
        }
      };

      send(": connected\n\n");

      unsubscribe = await subscribe(tokens, (event: ChangeEvent) => {
        send(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      // Fires when the client disconnects or navigates away.
      request.signal.addEventListener("abort", () => {
        unsubscribe?.();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });
    },

    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables response buffering on nginx-style reverse proxies, which would
      // otherwise hold events until the buffer fills and defeat streaming.
      "X-Accel-Buffering": "no",
    },
  });
}
