import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ChatBox from "@/components/ChatBox";
import MindAvatar from "@/components/MindAvatar";
import { getSessionEmail } from "@/lib/auth";
import { getListing, getRental } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ rental?: string }>;
}) {
  const { listingId } = await params;
  const { rental: rentalId } = await searchParams;
  const sessionEmail = await getSessionEmail();
  if (!sessionEmail) redirect(`/login?next=${encodeURIComponent(`/chat/${listingId}${rentalId ? `?rental=${rentalId}` : ""}`)}`);
  const listing = await getListing(listingId).catch(() => null);
  if (!listing) notFound();

  // Rental gate: the rental must exist, be active, and belong to the signed-in account.
  const rental = rentalId ? await getRental(rentalId).catch(() => null) : null;
  const rentalValid =
    !!rental &&
    rental.listing_id === listing.id &&
    rental.renter_email === sessionEmail &&
    rental.status === "active" &&
    new Date(rental.ends_at) > new Date();

  return (
    <main className="container page narrow">
      <Link href={`/mind/${listing.id}`} style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        ← Back to {listing.title}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 4px", flexWrap: "wrap" }}>
        <MindAvatar seed={listing.title} size={52} radius={14} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>{listing.title}</h2>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            @{listing.mind_name} · live Mind chat via HelloMinds
          </span>
        </div>
        {rentalValid ? (
          <span className="pill pill-live">
            rented until {new Date(rental.ends_at).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {!listing.mind_id ? (
        <div className="notice">This listing has no live Mind attached.</div>
      ) : rentalValid ? (
        <>
          <ChatBox listingId={listing.id} rentalId={rental.id} />
          <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
            Pick a mode — <b>Ask</b> a question,
            <b> Draft</b> content in its voice, or <b>Predict</b> what the persona would do.
            Replies can take a minute or two; it&apos;s reasoning with real cognition.
          </p>
        </>
      ) : (
        <div className="card" style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <b>This chat is for renters.</b>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
            {rentalId
              ? "This rental link has expired or isn't valid for this Mind. Rent it again to keep chatting."
              : "Rent this Mind to unlock its chat — your rental link opens this room for the whole rental window."}
          </p>
          <Link href={`/mind/${listing.id}`} className="btn btn-primary" style={{ justifySelf: "start" }}>
            Rent {listing.title}
          </Link>
        </div>
      )}
    </main>
  );
}
