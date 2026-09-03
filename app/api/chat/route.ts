import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { resolveChatAccess, toPlainText } from "@/lib/chat-access";
import { addPoints, getRentalsForListing, updateRental } from "@/lib/db";
import type { PointsEvent } from "@/lib/types";
import { getWallet, spend } from "@/lib/wallet";
import { looksLikeInjection, wrapClientMessage, type TaskMode } from "@/lib/envelope";
import { mindsFor } from "@/lib/minds";
import { MIN_MIND_COGNITION, mindBalance } from "@/lib/mind-health";
import { POINTS, SEASON } from "@/lib/points";

export const maxDuration = 180;

/** GET /api/chat?listingId&rentalId or ?mindId — transcript (+ wallet info on rentals). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const user = await getAuthedUser();
    const r = await resolveChatAccess(
      user,
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
    if (r.kind === "renter" && user) {
      const wallet = await getWallet(user);
      session = {
        walletBalance: wallet.balance,
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
        text: toPlainText(m.messageText ?? ""),
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
    const user = await getAuthedUser();
    const r = await resolveChatAccess(user, listingId ?? null, mindId ?? null, rentalId ?? null);
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
      const wallet = await getWallet(user!);
      if (wallet.balance < price) {
        return NextResponse.json(
          { error: `Not enough cognition — this Mind costs ${price} per message and your rental balance is ${Math.floor(wallet.balance)}. Your balance is backed by your real HelloMinds cognition; top up your Minds to raise it.` },
          { status: 402 },
        );
      }
      // Fix 2: if the Mind is out of real cognition it can't reply — refuse
      // WITHOUT charging the renter, so nobody pays for silence.
      const bal = await mindBalance(r.key, r.mindId);
      if (bal != null && bal < MIN_MIND_COGNITION) {
        return NextResponse.json(
          { error: "This Mind just ran out of cognition and can't answer right now — you were not charged. Its trainer needs to top it up." },
          { status: 409 },
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
      const firstPaidMessage = r.rental.messages_used === 0;
      walletBalance = await spend(user!, price);
      await updateRental(r.rental.id, {
        messages_used: r.rental.messages_used + 1,
        cognition_spent: Number(r.rental.cognition_spent) + price,
      });
      const renterPts = Math.round(price * POINTS.RENTER_PER_COGNITION);
      const stewardPts = Math.round(price * POINTS.STEWARD_PER_COGNITION);
      const events: Partial<PointsEvent>[] = [
        {
          subject_email: r.rental.renter_email,
          role: "renter",
          event_type: "renter_usage",
          points: renterPts,
          meta: { rentalId: r.rental.id, listing: r.listing.title, cognition: price, season: SEASON },
        },
        {
          subject_email: r.listing.steward_email,
          subject_name: r.listing.steward_name,
          role: "steward",
          event_type: "rental_supply",
          points: stewardPts,
          meta: { rentalId: r.rental.id, listing: r.listing.title, cognition: price, season: SEASON },
        },
      ];
      // Spend-gated acquisition bonus: pay the trainer once, on this renter's
      // FIRST paid message, and only if they've never paid on this listing before.
      if (firstPaidMessage) {
        const priorPaid = (await getRentalsForListing(r.listing.id).catch(() => []))
          .some((x) => x.renter_email === r.rental.renter_email && x.id !== r.rental.id && x.messages_used > 0);
        if (!priorPaid) {
          events.push({
            subject_email: r.listing.steward_email,
            subject_name: r.listing.steward_name,
            role: "steward",
            event_type: "rental_supply",
            points: POINTS.NEW_PAYING_RENTER_BONUS,
            meta: { rentalId: r.rental.id, listing: r.listing.title, reason: "new paying renter", season: SEASON },
          });
        }
      }
      await addPoints(events);
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
