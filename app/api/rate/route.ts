import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { addPoints, getRatingForRental, getRental, recomputeListingRating, upsertRating } from "@/lib/db";

/** POST /api/rate {rentalId, stars, comment?} — rate a Mind you rented (once per rental, editable). */
export async function POST(req: Request) {
  try {
    const email = await getSessionEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { rentalId, stars, comment } = await req.json();
    const n = Math.round(Number(stars));
    if (!rentalId || n < 1 || n > 5) {
      return NextResponse.json({ error: "rentalId and stars (1-5) required" }, { status: 400 });
    }
    const rental = await getRental(rentalId).catch(() => null);
    if (!rental || rental.renter_email !== email) {
      return NextResponse.json({ error: "Rental not found on your account" }, { status: 404 });
    }
    if (rental.messages_used < 1) {
      return NextResponse.json({ error: "Chat with the Mind at least once before rating it" }, { status: 400 });
    }

    const existing = await getRatingForRental(rentalId);
    const rating = await upsertRating({
      rental_id: rentalId,
      listing_id: rental.listing_id,
      stars: n,
      comment: String(comment ?? "").slice(0, 500) || null,
    });
    await recomputeListingRating(rental.listing_id);

    if (!existing) {
      await addPoints([
        {
          subject_email: email,
          role: "renter",
          event_type: "bonus",
          points: 5,
          meta: { rentalId, reason: "rated a rental" },
        },
      ]);
    }
    return NextResponse.json({ rating, firstRating: !existing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "rating error" }, { status: 500 });
  }
}
