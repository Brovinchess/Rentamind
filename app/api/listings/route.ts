import { NextResponse } from "next/server";
import { getAuthedUser, type AuthedUser } from "@/lib/auth";
import { createListing, getListing, getListingsForSteward, updateListing } from "@/lib/db";
import { roleDnaMessage } from "@/lib/envelope";
import { listMindsFor, mindsFor } from "@/lib/minds";
import type { Listing } from "@/lib/types";

const EDITABLE_FIELDS = [
  "title",
  "tagline",
  "description",
  "category",
  "emoji",
  "label",
  "price_per_message",
  "min_days",
  "max_concurrent",
] as const;

function pickEditable(body: Record<string, unknown>): Partial<Listing> {
  const patch: Record<string, unknown> = {};
  for (const f of EDITABLE_FIELDS) {
    if (body[f] !== undefined) patch[f] = body[f];
  }
  if (patch.price_per_message !== undefined) {
    patch.price_per_message = Math.max(1, Math.min(500, Number(patch.price_per_message) || 10));
  }
  if (patch.min_days !== undefined) patch.min_days = Math.max(1, Math.min(30, Number(patch.min_days) || 1));
  if (patch.max_concurrent !== undefined) {
    patch.max_concurrent = Math.max(1, Math.min(20, Number(patch.max_concurrent) || 3));
  }
  return patch as Partial<Listing>;
}

/** Sends the trainer-vs-client protection rule to the Mind (once per listing), via the owner's key. */
async function sendServiceDna(user: AuthedUser, listing: Listing): Promise<void> {
  if (!listing.mind_id || listing.service_dna_sent_at) return;
  try {
    const alias = `ram-${listing.mind_id.slice(0, 8)}`;
    const c = mindsFor(user.builderKey);
    await c.ensureConversation(alias, listing.mind_id);
    await c.sendMessage({ alias, messageText: roleDnaMessage(user.email) });
    await updateListing(listing.id, { service_dna_sent_at: new Date().toISOString() });
  } catch {
    // best-effort — retried on next edit
  }
}

/** Ownership guard: the listing must belong to the signed-in user. */
async function ownListing(user: AuthedUser, listingId: string | undefined): Promise<Listing | NextResponse> {
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });
  const listing = await getListing(listingId);
  if (!listing || listing.steward_email !== user.email) {
    return NextResponse.json({ error: "Listing not found on your account" }, { status: 404 });
  }
  return listing;
}

/** POST /api/listings — list one of YOUR Minds for rent. */
export async function POST(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const { mindId, title } = body;
    if (!mindId || !title) {
      return NextResponse.json({ error: "mindId and title are required" }, { status: 400 });
    }
    const owned = await listMindsFor(user.builderKey);
    const mind = owned.find((m) => m.mindId === mindId);
    if (!mind) {
      return NextResponse.json({ error: "That Mind isn't on your account" }, { status: 403 });
    }

    const existing = (await getListingsForSteward(user.email)).find((l) => l.mind_id === mindId);
    if (existing?.is_active) {
      return NextResponse.json({ error: "This Mind is already listed" }, { status: 409 });
    }
    if (existing) {
      const listing = await updateListing(existing.id, { ...pickEditable(body), is_active: true });
      await sendServiceDna(user, listing);
      return NextResponse.json({ listing, relisted: true });
    }

    const listing = await createListing({
      mind_id: mindId,
      mind_name: mind.name ?? "unnamed",
      steward_email: user.email,
      steward_name: user.email.split("@")[0],
      owner_human_id: user.humanId,
      category: "Experts",
      emoji: "brain",
      ...pickEditable(body),
      is_seeded: false,
    });
    await sendServiceDna(user, listing);
    return NextResponse.json({ listing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "listing error" }, { status: 500 });
  }
}

/** PATCH /api/listings — edit or relist your listing. */
export async function PATCH(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const listing = await ownListing(user, body.listingId);
    if (listing instanceof NextResponse) return listing;
    const patch = pickEditable(body);
    if (body.relist === true) patch.is_active = true;
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
    }
    let updated = await updateListing(listing.id, patch);
    if (updated.is_active && !updated.service_dna_sent_at) {
      await sendServiceDna(user, updated);
      updated = (await getListing(updated.id)) ?? updated;
    }
    return NextResponse.json({ listing: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "listing error" }, { status: 500 });
  }
}

/** DELETE /api/listings — delist. Rental history is kept; active rentals run out. */
export async function DELETE(req: Request) {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const body = await req.json();
    const listing = await ownListing(user, body.listingId);
    if (listing instanceof NextResponse) return listing;
    const updated = await updateListing(listing.id, { is_active: false });
    return NextResponse.json({ listing: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "listing error" }, { status: 500 });
  }
}
