import { NextResponse } from "next/server";
import { createListing, getListings } from "@/lib/db";
import { listMindsCached, STEWARD_EMAIL } from "@/lib/minds";

/** POST /api/listings — steward lists one of their live Minds for rent */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mindId, title, tagline, description, category, ratePerDay, emoji, label } = body;
    if (!mindId || !title) {
      return NextResponse.json({ error: "mindId and title are required" }, { status: 400 });
    }
    const owned = await listMindsCached();
    const mind = owned.find((m) => m.mindId === mindId);
    if (!mind) {
      return NextResponse.json({ error: "That Mind isn't on your account" }, { status: 403 });
    }
    const existing = await getListings();
    if (existing.some((l) => l.mind_id === mindId)) {
      return NextResponse.json({ error: "This Mind is already listed" }, { status: 409 });
    }
    const listing = await createListing({
      mind_id: mindId,
      mind_name: mind.name ?? "unnamed",
      steward_email: STEWARD_EMAIL,
      steward_name: "Rovin",
      title,
      tagline: tagline ?? "",
      description: description ?? "",
      category: category ?? "Experts",
      emoji: emoji ?? "🧠",
      label: label ?? "",
      rate_cognition_per_day: Math.max(10, Number(ratePerDay) || 100),
      is_seeded: false,
    });
    return NextResponse.json({ listing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "listing error" }, { status: 500 });
  }
}
