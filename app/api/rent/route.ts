import { NextResponse } from "next/server";
import { addPoints, createRental, getListing, getOrCreateWallet, getRentalsForListing, updateRental } from "@/lib/db";
import { minds } from "@/lib/minds";
import { POINTS } from "@/lib/points";

/**
 * POST /api/rent — start a rental session.
 * v2 (proxied): the renter is NOT added to the Mind's Circle. Instead each rental
 * gets its own private conversation with the Mind, accessed only through our chat.
 * Payment model: renting is free to start; each message costs the listing's
 * price_per_message from the renter's cognition wallet (Season 0: free 1,000 grant).
 */
export async function POST(req: Request) {
  try {
    const { listingId, renterEmail, days } = await req.json();
    const email = String(renterEmail ?? "").trim().toLowerCase();
    const nDays = Math.max(1, Math.min(30, Number(days) || 7));
    if (!listingId || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "listingId and a valid renterEmail are required" }, { status: 400 });
    }
    const listing = await getListing(listingId);
    if (!listing || !listing.is_active) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }
    if (!listing.mind_id) {
      return NextResponse.json({ error: "This listing has no live Mind attached" }, { status: 400 });
    }

    const allRentals = await getRentalsForListing(listingId);
    const active = allRentals.filter((r) => r.status === "active");
    if (active.length >= listing.max_concurrent) {
      return NextResponse.json({ error: "This Mind is fully rented right now" }, { status: 409 });
    }
    const existing = active.find((r) => r.renter_email === email);
    if (existing) {
      // Already renting — return the existing session instead of double-charging points.
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

    // Private conversation for this rental — isolated from training and other renters.
    const alias = `ram-${listing.mind_id.slice(0, 8)}-${rental.id.slice(0, 8)}`;
    try {
      await minds().ensureConversation(alias, listing.mind_id);
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
