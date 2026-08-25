import { NextResponse } from "next/server";
import { addPoints, createRental, getListing, getRentalsForListing } from "@/lib/db";
import { minds } from "@/lib/minds";
import { POINTS } from "@/lib/points";

export async function POST(req: Request) {
  try {
    const { listingId, renterEmail, days } = await req.json();
    const email = String(renterEmail ?? "").trim().toLowerCase();
    const nDays = Math.max(1, Math.min(30, Number(days) || 1));
    if (!listingId || !/.+@.+\..+/.test(email)) {
      return NextResponse.json({ error: "listingId and a valid renterEmail are required" }, { status: 400 });
    }
    const listing = await getListing(listingId);
    if (!listing || !listing.is_active) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const active = await getRentalsForListing(listingId, "active");
    if (active.length >= listing.max_concurrent) {
      return NextResponse.json({ error: "This Mind is fully rented right now" }, { status: 409 });
    }
    const priorRenters = new Set((await getRentalsForListing(listingId)).map((r) => r.renter_email));

    // Real circle grant for live Minds
    let circleAdded = false;
    let circleDetail = "";
    let mindEmail: string | null = null;
    if (listing.mind_id) {
      try {
        const res = await minds().addCircleMembers(listing.mind_id, { emails: [email], isActive: true });
        circleAdded = true;
        circleDetail = JSON.stringify(res.summary ?? res.items ?? {});
        try {
          const detail = await minds().getMind(listing.mind_id);
          mindEmail = (detail.email as string | null) ?? null;
        } catch { /* optional */ }
      } catch (e) {
        return NextResponse.json(
          { error: `Circle add failed: ${e instanceof Error ? e.message : String(e)}` },
          { status: 502 },
        );
      }
    }

    const cognitionFunded = Number(listing.rate_cognition_per_day) * nDays;
    const rental = await createRental({
      listing_id: listing.id,
      renter_email: email,
      days: nDays,
      ends_at: new Date(Date.now() + nDays * 86_400_000).toISOString(),
      cognition_funded: cognitionFunded,
      circle_added: circleAdded,
    });

    const firstTime = !priorRenters.has(email);
    const stewardPts = POINTS.RENTAL_SUPPLY_PER_DAY * nDays + (firstTime ? POINTS.FIRST_RENTER_BONUS : 0);
    const renterPts = POINTS.RENTER_CHECKOUT_BONUS;
    await addPoints([
      {
        subject_email: listing.steward_email,
        subject_name: listing.steward_name,
        role: "steward",
        event_type: "rental_supply",
        points: stewardPts,
        meta: { rentalId: rental.id, listing: listing.title, days: nDays, firstTimeRenter: firstTime },
      },
      {
        subject_email: email,
        role: "renter",
        event_type: "bonus",
        points: renterPts,
        meta: { rentalId: rental.id, listing: listing.title, reason: "checkout" },
      },
    ]);

    return NextResponse.json({
      rentalId: rental.id,
      circleAdded,
      circleDetail,
      mindEmail,
      points: { steward: stewardPts, renter: renterPts },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
