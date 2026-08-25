import Link from "next/link";
import { notFound } from "next/navigation";
import ChatBox from "@/components/ChatBox";
import { getListing } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  const listing = await getListing(listingId).catch(() => null);
  if (!listing) notFound();

  return (
    <main className="container page narrow">
      <Link href={`/mind/${listing.id}`} style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        ← Back to {listing.title}
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0 4px" }}>
        <div className="avatar">{listing.emoji}</div>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>{listing.title}</h2>
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
            @{listing.mind_name} · live Mind chat via HelloMinds
          </span>
        </div>
      </div>
      {listing.mind_id ? (
        <ChatBox listingId={listing.id} />
      ) : (
        <div className="notice">
          This is a seeded demo Mind without a live brain. Rent one of the <b>Live</b> listings to
          chat for real.
        </div>
      )}
      <p style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
        Replies come from the actual Mind on HelloMinds and can take up to a couple of minutes —
        it&apos;s reasoning, running tools, and burning real cognition. In production renters also chat
        by emailing the Mind directly or via its Telegram bot.
      </p>
    </main>
  );
}
