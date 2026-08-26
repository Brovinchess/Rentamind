import { NextResponse } from "next/server";
import { getBuilderKeyForEmail, getSessionEmail } from "@/lib/auth";
import { addPoints, createRental, getListing, getOrCreateWallet, getRentalsForListing, updateRental } from "@/lib/db";
import { mindsFor } from "@/lib/minds";
import { POINTS } from "@/lib/points";

/**
 * POST /api/rent — start a rental session for the signed-in user.
 * The private conversation is opened through the LISTING OWNER's stored key
 * (Minds only talk to their own steward's account), and the renter reaches it
 * exclusively through our proxied chat.
 */
export async function POST(req: Request) {
  try {
    const email = await getSessionEmail();
    if (!email) return NextResponse.json({ error: "Sign in to rent" }, { status: 401 });
    const { listingId, days } = await req.json();
    const nDays = Math.max(1, Math.min(30, Number(days) || 7));
    if (!listingId) {
      return NextResponse.json({ error: "listingId required" }, { status: 400 });
    }
    const listing = await getListing(listingId);
    if (!listing || !listing.is_active) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (!listing.mind_id) {
      return NextResponse.json({ error: "This listing has no live Mind attached" }, { status: 400 });
    }
    if (listing.steward_email === email) {
      return NextResponse.json({ error: "That's your own Mind — chat with it for free in its training room" }, { status: 400 });
    }

    const ownerKey = await getBuilderKeyForEmail(listing.steward_email);
    if (!ownerKey) {
      return NextResponse.json({ error: "This Mind's trainer hasn't connected their account recently — try another listing" }, { status: 409 });
    }

    const allRentals = await getRentalsForListing(listingId);
    const active = allRentals.filter((r) => r.status === "active");
    if (active.length >= listing.max_concurrent) {
      return NextResponse.json({ error: "This Mind is fully rented right now" }, { status: 409 });
    }
    const existing = active.find((r) => r.renter_email === email);
    if (existing) {
      const wallet = await getOrCreateWallet(email);
      return NextResponse.json({
        rentalId: existing.id,
        alreadyRenting: true,
        walletBalance: Number(wallet.cognition),
        pricePerMessage: Number(listing.price_per_message),
        points: { steward: 0, renter: 0 },
      });
    }
    const firstTime = !allRentals.some((r) => r.renter_email === email);

    const wallet = await getOrCreateWallet(email);
    const rental = await createRental({
      listing_id: listing.id,
      renter_email: email,
      days: nDays,
      ends_at: new Date(Date.now() + nDays * 86_400_000).toISOString(),
      circle_added: false,
    });

    const alias = `ram-${listing.mind_id.slice(0, 8)}-${rental.id.slice(0, 8)}`;
    try {
      await mindsFor(ownerKey).ensureConversation(alias, listing.mind_id);
      await updateRental(rental.id, { conversation_alias: alias });
    } catch (e) {
      return NextResponse.json(
        { error: `Could not open a session with the Mind: ${e instanceof Error ? e.message : e}` },
        { status: 502 },
      );
    }

    const stewardPts = firstTime ? POINTS.FIRST_RENTER_BONUS : POINTS.NEW_RENTAL_BONUS;
    const renterPts = POINTS.RENTER_CHECKOUT_BONUS;
    await addPoints([
      {
        subject_email: listing.steward_email,
        subject_name: listing.steward_name,
        role: "steward",
        event_type: "rental_supply",
        points: stewardPts,
        meta: { rentalId: rental.id, listing: listing.title, firstTimeRenter: firstTime },
      },
      {
        subject_email: email,
        role: "renter",
        event_type: "bonus",
        points: renterPts,
        meta: { rentalId: rental.id, listing: listing.title, reason: "rental started" },
      },
    ]);

    return NextResponse.json({
      rentalId: rental.id,
      walletBalance: Number(wallet.cognition),
      pricePerMessage: Number(listing.price_per_message),
      points: { steward: stewardPts, renter: renterPts },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
