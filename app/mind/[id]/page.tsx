import Link from "next/link";
import { notFound } from "next/navigation";
import RentPanel from "@/components/RentPanel";
import MindAvatar from "@/components/MindAvatar";
import RunwayBadge from "@/components/RunwayBadge";
import { LiveBadge, Stars } from "@/components/MindCard";
import { MIN_MIND_COGNITION } from "@/lib/mind-health";
import { getAccessTokenForEmail } from "@/lib/auth";
import { getListing, getRentalsForListing } from "@/lib/db";
import { getLiveMindStats, trainingScore, type LiveMindStats } from "@/lib/minds";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) notFound();

  let stats: LiveMindStats | null = null;
  let score = listing.training_score;
  const ownerKey = listing.mind_id ? await getAccessTokenForEmail(listing.steward_email) : null;
  // Rentals run through the trainer's HelloMinds connection. Those last 30 days
  // from sign-in, so a trainer who hasn't reconnected has a Mind nobody can reach.
  const trainerOffline = !!listing.mind_id && !ownerKey;
  if (listing.mind_id && ownerKey) {
    stats = await getLiveMindStats(ownerKey, listing.mind_id);
    score = trainingScore({
      createdAt: listing.created_at,
      usageWindow: stats.usageWindow,
      skillsCount: stats.skillsCount,
    });
  }
  const activeRentals = await getRentalsForListing(id, "active").catch(() => []);

  return (
    <main className="container page narrow" style={{ paddingTop: 28 }}>
      <Link href="/marketplace" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>← Back to Marketplace</Link>

      <div className="detail-hero" style={{ marginTop: 18 }}>
        <MindAvatar seed={listing.title} size={72} radius={18} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800 }}>{listing.title}</h1>
            <LiveBadge live={!!listing.mind_id} />
            {listing.label ? <span className="pill pill-label">{listing.label}</span> : null}
          </div>
          <p className="mono" style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "4px 0" }}>
            @{listing.mind_name} · trainer {listing.steward_name} · {listing.category}
          </p>
          <Stars rating={Number(listing.rating)} count={listing.rating_count} />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Training Score</div><div className="v">{score}<small> / 1000</small></div></div>
        <div className="stat"><div className="k">Price</div><div className="v">{Number(listing.price_per_message).toLocaleString()}<small> cognition / message</small></div></div>
        {stats?.runway ? (
          <div className="stat">
            <div className="k">Cognition runway</div>
            <div className="v" style={{ fontSize: "1.05rem" }}><RunwayBadge runway={stats.runway} /></div>
          </div>
        ) : null}
        {stats?.balance != null ? (
          <div className="stat"><div className="k">Live cognition balance</div><div className="v">{Math.round(stats.balance).toLocaleString()}</div></div>
        ) : null}
        {stats?.usageWindow != null ? (
          <div className="stat"><div className="k">Cognition burned · {stats.usageWindowDays ?? 14}d</div><div className="v">{stats.usageWindow.toLocaleString()}</div></div>
        ) : null}
        <div className="stat"><div className="k">Active rentals</div><div className="v">{activeRentals.length}<small> / {listing.max_concurrent}</small></div></div>
      </div>

      <p style={{ fontSize: "1.02rem" }}>{listing.description}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0 26px" }}>
        {listing.tags.map((t) => (
          <span key={t} className="pill pill-cat">{t}</span>
        ))}
      </div>

      {listing.sample_qa?.length ? (
        <>
          <span className="eyebrow section-eyebrow">Sample exchanges</span>
          <div className="qa" style={{ margin: "10px 0 28px" }}>
            {listing.sample_qa.map((qa, i) => (
              <div className="card" key={i}>
                <div className="q">“{qa.q}”</div>
                <div className="a">{qa.a}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {trainerOffline ? (
        <div className="notice" style={{ borderColor: "var(--warn)" }}>
          <b>This Mind is offline.</b> Its trainer&apos;s HelloMinds connection has lapsed, so it
          can&apos;t answer renters until they reconnect. Nothing has been charged.
        </div>
      ) : stats?.balance != null && stats.balance < MIN_MIND_COGNITION ? (
        <div className="notice" style={{ borderColor: "var(--danger)" }}>
          <b>This Mind is out of cognition.</b> It can&apos;t answer until its trainer tops it up, so
          renting it now would leave you with a Mind that stays silent. Its trainer sees the same
          warning on their dashboard.
        </div>
      ) : activeRentals.length >= listing.max_concurrent ? (
        <div className="notice">
          This Mind is fully rented right now ({activeRentals.length}/{listing.max_concurrent} slots).
          Check back when a rental window closes.
        </div>
      ) : (
        <RentPanel
          listingId={listing.id}
          title={listing.title}
          pricePerMessage={Number(listing.price_per_message)}
          minDays={listing.min_days}
          isLive={!!listing.mind_id}
        />
      )}

      <div className="notice" style={{ marginTop: 26 }}>
        <b>How renting works:</b> you get a private chat session with the live, trained Mind. Each
        message costs cognition from your balance, and every cognition you spend earns you points.
        Your session can&apos;t change how the Mind behaves — only its trainer can train it.
      </div>
    </main>
  );
}
