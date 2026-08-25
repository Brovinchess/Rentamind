import { NextResponse } from "next/server";
import { getListing } from "@/lib/db";
import { minds } from "@/lib/minds";

export const maxDuration = 180;

function aliasFor(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
}

/** Mind replies arrive as HTML; flatten to plain text for the chat bubbles. */
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

/** GET /api/chat?listingId=… — recent transcript */
export async function GET(req: Request) {
  try {
    const listingId = new URL(req.url).searchParams.get("listingId");
    if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
    const listing = await getListing(listingId);
    if (!listing?.mind_id) return NextResponse.json({ error: "Not a live Mind" }, { status: 404 });

    const alias = aliasFor(listing.mind_id);
    const c = minds();
    await c.ensureConversation(alias, listing.mind_id);
    const rows = await c.getHistory(alias, { limit: 50 });
    rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    return NextResponse.json({
      alias,
      messages: rows.map((r) => ({
        fingerprint: r.fingerprint,
        text: toPlainText(r.messageText ?? ""),
        fromMind: r.senderType !== 1,
        at: r.createdAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat error" }, { status: 500 });
  }
}

/** POST /api/chat {listingId, text} — send and wait for the Mind's reply */
export async function POST(req: Request) {
  try {
    const { listingId, text } = await req.json();
    if (!listingId || !text?.trim()) {
      return NextResponse.json({ error: "listingId and text required" }, { status: 400 });
    }
    const listing = await getListing(listingId);
    if (!listing?.mind_id) {
      return NextResponse.json(
        { error: "Seeded demo Minds don't have a live brain to chat with — try a Live listing." },
        { status: 400 },
      );
    }

    const alias = aliasFor(listing.mind_id);
    const c = minds();
    await c.ensureConversation(alias, listing.mind_id);
    const before = await c.getLatestHistoryFingerprint(alias);
    await c.sendMessage({ alias, messageText: text.trim() });
    const outcome = await c.waitForReply({
      alias,
      timeoutMs: 150_000,
      afterFingerprint: before,
      sentMessageText: text.trim(),
    });

    if (outcome.timedOut) {
      return NextResponse.json({ reply: null, timedOut: true });
    }
    return NextResponse.json({
      reply: toPlainText(outcome.reply.messageText ?? ""),
      timedOut: false,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat error" }, { status: 500 });
  }
}
