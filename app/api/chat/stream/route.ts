import { getAuthedUser } from "@/lib/auth";
import { resolveChatAccess, toPlainText } from "@/lib/chat-access";
import { mindsFor } from "@/lib/minds";

export const maxDuration = 300;

/**
 * GET /api/chat/stream?listingId&rentalId or ?mindId
 * True real-time replies: proxies the HelloMinds SSE event stream (scoped to
 * this conversation's alias) down to the browser. EventSource auto-reconnects
 * when the function's max duration ends the stream.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = await getAuthedUser();
  const r = await resolveChatAccess(
    user,
    url.searchParams.get("listingId"),
    url.searchParams.get("mindId"),
    url.searchParams.get("rentalId"),
  );
  if ("error" in r) {
    return Response.json({ error: r.error }, { status: r.status });
  }

  const c = mindsFor(r.key);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const push = (obj: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          closed = true;
        }
      };
      push({ type: "connected" });

      const sub = c.subscribeEvents({
        alias: r.alias,
        onEvent: (e) => {
          const text = toPlainText(e.messageText ?? "");
          if (!text) return;
          push({
            type: "message",
            fingerprint: e.fingerprint,
            fromMind: e.senderType !== 1,
            text,
            at: e.createdAt ?? null,
          });
        },
        onError: () => push({ type: "upstream-error" }),
      });

      const heartbeat = setInterval(() => push({ type: "ping" }), 15_000);
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try {
          sub.close();
        } catch {}
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
