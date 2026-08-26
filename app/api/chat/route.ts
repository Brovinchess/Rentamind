import { NextResponse } from "next/server";
import { getAuthedUser, getBuilderKeyForEmail } from "@/lib/auth";
import { addPoints, getListing, getOrCreateWallet, getRental, spendFromWallet, updateRental } from "@/lib/db";
import { looksLikeInjection, wrapClientMessage, type TaskMode } from "@/lib/envelope";
import { listMindsFor, mindsFor } from "@/lib/minds";
import { POINTS } from "@/lib/points";
import type { Listing, Rental } from "@/lib/types";

export const maxDuration = 180;

function stewardAlias(mindId: string) {
  return `ram-${mindId.slice(0, 8)}`;
}
function rentalAlias(mindId: string, rentalId: string) {
  return `ram-${mindId.slice(0, 8)}-${rentalId.slice(0, 8)}`;
}

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

type Resolved =
  | { kind: "trainer"; mindId: string; alias: string; key: string }
  | { kind: "renter"; mindId: string; alias: string; key: string; rental: Rental; listing: Listing }
  | { error: string; status: number };

/**
 * Trainer path: your own mindId — raw training channel via YOUR key.
 * Renter path: listingId + your rentalId — proxied service session via the
 * listing OWNER's stored key.
 */
async function resolve(listingId: string | null, mindId: string | null, rentalId: string | null): Promise<Resolved> {
  const user = await getAuthedUser();
  if (!user) return { error: "Sign in required", status: 401 };

  if (mindId) {
    const owned = await listMindsFor(user.builderKey);
    if (!owned.some((m) => m.mindId === mindId)) {
      return { error: "That Mind isn't on your account", status: 404 };
    }
    return { kind: "trainer", mindId, alias: stewardAlias(mindId), key: user.builderKey };
  }
  if (listingId) {
    const listing = await getListing(listingId);
    if (!listing?.mind_id) return { error: "Not a live Mind", status: 404 };
    if (!rentalId) return { error: "An active rental is required to chat with this Mind", status: 403 };
    const rental = await getRental(rentalId).catch(() => null);
    if (!rental || rental.listing_id !== listingId) {
      return { error: "Rental not found for this listing", status: 403 };
    }
    if (rental.renter_email !== user.email) {
      return { error: "This rental belongs to a different account", status: 403 };
    }
    if (rental.status !== "active" || new Date(rental.ends_at) <= new Date()) {
      return { error: "This rental has ended — rent the Mind again to keep chatting", status: 403 };
    }
    const ownerKey = await getBuilderKeyForEmail(listing.steward_email);
    if (!ownerKey) return { error: "This Mind's trainer is unavailable right now", status: 409 };
    const alias = rental.conversation_alias ?? rentalAlias(listing.mind_id, rental.id);
    return { kind: "renter", mindId: listing.mind_id, alias, key: ownerKey, rental, listing };
  }
  return { error: "listingId or mindId required", status: 400 };
}

/** GET /api/chat?listingId&rentalId or ?mindId — transcript (+ wallet info on rentals). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const r = await resolve(
      url.searchParams.get("listingId"),
      url.searchParams.get("mindId"),
      url.searchParams.get("rentalId"),
    );
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    const c = mindsFor(r.key);
    await c.ensureConversation(r.alias, r.mindId);
    const rows = await c.getHistory(r.alias, { limit: 50 });
    rows.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());

    let session = null;
    if (r.kind === "renter") {
      const wallet = await getOrCreateWallet(r.rental.renter_email);
      session = {
        walletBalance: Number(wallet.cognition),
        pricePerMessage: Number(r.listing.price_per_message),
        messagesUsed: r.rental.messages_used,
        cognitionSpent: Number(r.rental.cognition_spent),
        endsAt: r.rental.ends_at,
      };
    }

    return NextResponse.json({
      alias: r.alias,
      session,
      messages: rows.map((m) => ({
        fingerprint: m.fingerprint,
        text: toPlainText(m.messageText ?? "").replace(/^\[RENTAL SESSION[^\]]*\][ \t\r\n]*/, ""),
        fromMind: m.senderType !== 1,
        at: m.createdAt,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat error" }, { status: 500 });
  }
}

/** POST /api/chat {listingId+rentalId | mindId, text, task?} — send and wait for the reply. */
export async function POST(req: Request) {
  try {
    const { listingId, mindId, rentalId, text, task } = await req.json();
    if ((!listingId && !mindId) || !text?.trim()) {
      return NextResponse.json({ error: "listingId or mindId, and text, required" }, { status: 400 });
    }
    const r = await resolve(listingId ?? null, mindId ?? null, rentalId ?? null);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

    let outgoing = text.trim();
    let price = 0;

    if (r.kind === "renter") {
      if (looksLikeInjection(outgoing)) {
        return NextResponse.json(
          { error: "That message looks like an attempt to retrain the Mind. Rentals are for asking, drafting, and predicting — training is trainer-only." },
          { status: 400 },
        );
      }
      price = Number(r.listing.price_per_message);
      const wallet = await getOrCreateWallet(r.rental.renter_email);
      if (Number(wallet.cognition) < price) {
        return NextResponse.json(
          { error: `Not enough cognition — this Mind costs ${price} per message and your balance is ${Math.floor(Number(wallet.cognition))}.` },
          { status: 402 },
        );
      }
      const mode: TaskMode = ["ask", "draft", "predict"].includes(task) ? task : "ask";
      outgoing = wrapClientMessage(mode, outgoing);
    }

    const c = mindsFor(r.key);
    await c.ensureConversation(r.alias, r.mindId);
    const before = await c.getLatestHistoryFingerprint(r.alias);
    await c.sendMessage({ alias: r.alias, messageText: outgoing });

    let walletBalance: number | null = null;
    if (r.kind === "renter" && price > 0) {
      walletBalance = await spendFromWallet(r.rental.renter_email, price);
      await updateRental(r.rental.id, {
        messages_used: r.rental.messages_used + 1,
        cognition_spent: Number(r.rental.cognition_spent) + price,
      });
      const renterPts = Math.round(price * POINTS.RENTER_PER_COGNITION);
      const stewardPts = Math.round(price * POINTS.STEWARD_PER_COGNITION);
      await addPoints([
        {
          subject_email: r.rental.renter_email,
          role: "renter",
          event_type: "renter_usage",
          points: renterPts,
          meta: { rentalId: r.rental.id, listing: r.listing.title, cognition: price },
        },
        {
          subject_email: r.listing.steward_email,
          subject_name: r.listing.steward_name,
          role: "steward",
          event_type: "rental_supply",
          points: stewardPts,
          meta: { rentalId: r.rental.id, listing: r.listing.title, cognition: price },
        },
      ]);
    }

    const outcome = await c.waitForReply({
      alias: r.alias,
      timeoutMs: 150_000,
      afterFingerprint: before,
      sentMessageText: outgoing,
    });

    if (outcome.timedOut) {
      return NextResponse.json({ reply: null, timedOut: true, walletBalance });
    }
    return NextResponse.json({
      reply: toPlainText(outcome.reply.messageText ?? ""),
      timedOut: false,
      walletBalance,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "chat error" }, { status: 500 });
  }
}
