import { NextResponse } from "next/server";
import { getListing, getRental } from "@/lib/db";
import { listMindsCached, minds } from "@/lib/minds";

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

/**
 * Resolve a target mindId. Two allowed paths (QA finding C2):
 * - steward: a mindId owned by the account's Builder key
 * - renter: a listingId plus the rentalId issued at checkout, which must be an
 *   active, unexpired rental of that listing
 */
async function resolveMindId(
  listingId: string | null,
  mindId: string | null,
  rentalId: string | null,
): Promise<{ mindId: string } | { error: string; status: number }> {
  if (mindId) {
    const owned = await listMindsCached();
    return owned.some((m) => m.mindId === mindId)
      ? { mindId }
      : { error: "Not a live Mind on this account", status: 404 };
  }
  if (listingId) {
    const listing = await getListing(listingId);
    if (!listing?.mind_id) return { error: "Not a live Mind", status: 404 };
    if (!rentalId) return { error: "An active rental is required to chat with this Mind", status: 403 };
    const rental = await getRental(rentalId).catch(() => null);
    if (!rental || rental.listing_id !== listingId) {
      return { error: "Rental not found for this listing", status: 403 };
    }
    if (rental.status !== "active" || new Date(rental.ends_at) <= new Date()) {
      return { error: "This rental has ended — rent the Mind again to keep chatting", status: 403 };
    }
    return { mindId: listing.mind_id };
  }
  return { error: "listingId or mindId required", status: 400 };
}

/** GET /api/chat?listingId=… or ?mindId=… — recent transcript */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const resolved = await resolveMindId(
      url.searchParams.get("listingId"),
      url.searchParams.get("mindId"),
      url.searchParams.get("rentalId"),
    );
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const target = resolved.mindId;
    const alias = aliasFor(target);
    const c = minds();
    await c.ensureConversation(alias, target);
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

/** POST /api/chat {listingId | mindId, text} — send and wait for the Mind's reply */
export async function POST(req: Request) {
  try {
    const { listingId, mindId, rentalId, text } = await req.json();
    if ((!listingId && !mindId) || !text?.trim()) {
      return NextResponse.json({ error: "listingId or mindId, and text, required" }, { status: 400 });
    }
    const resolved = await resolveMindId(listingId ?? null, mindId ?? null, rentalId ?? null);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const target = resolved.mindId;
    const alias = aliasFor(target);
    const c = minds();
    await c.ensureConversation(alias, target);
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
