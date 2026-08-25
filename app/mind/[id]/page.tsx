import Link from "next/link";
import { notFound } from "next/navigation";
import RentPanel from "@/components/RentPanel";
import { LiveBadge, Stars } from "@/components/MindCard";
import { getListing, getRentalsForListing } from "@/lib/db";
import { getLiveMindStats, trainingScore, type LiveMindStats } from "@/lib/minds";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) notFound();

  let stats: LiveMindStats | null = null;
  let score = listing.training_score;
  if (listing.mind_id) {
    stats = await getLiveMindStats(listing.mind_id);
    score = trainingScore({
      createdAt: listing.created_at,
      usage30d: stats.usage30d,
      skillsCount: stats.skillsCount,
    });
  }
  const activeRentals = await getRentalsForListing(id, "active").catch(() => []);

  return (
    <main className="container page narrow" style={{ paddingTop: 28 }}>
      <Link href="/" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>← Back to the Mindshelf</Link>

      <div className="detail-hero" style={{ marginTop: 18 }}>
        <div className="avatar">{listing.emoji}</div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800 }}>{listing.title}</h1>
            <LiveBadge live={!!listing.mind_id} />
            {listing.label ? <span className="pill pill-label">{listing.label}</span> : null}
          </div>
          <p className="mono" style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "4px 0" }}>
            @{listing.mind_name} · steward {listing.steward_name} · {listing.category}
          </p>
          <Stars rating={Number(listing.rating)} count={listing.rating_count} />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><div className="k">Training Score</div><div className="v">{score}<small> / 1000</small></div></div>
        <div className="stat"><div className="k">Rate</div><div className="v">{Number(listing.rate_cognition_per_day).toLocaleString()}<small> cog/day</small></div></div>
        {stats?.balance != null ? (
          <div className="stat"><div className="k">Live cognition balance</div><div className="v">{Math.round(stats.balance).toLocaleString()}</div></div>
        ) : null}
        {stats?.usage30d != null ? (
          <div className="stat"><div className="k">Cognition burned · 30d</div><div className="v">{stats.usage30d.toLocaleString()}</div></div>
        ) : null}
        {stats?.circleSize != null ? (
          <div className="stat"><div className="k">Circle size</div><div className="v">{stats.circleSize}</div></div>
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

      {activeRentals.length >= listing.max_concurrent ? (
        <div className="notice">
          This Mind is fully rented right now ({activeRentals.length}/{listing.max_concurrent} slots).
          Check back when a rental window closes.
        </div>
      ) : (
        <RentPanel
          listingId={listing.id}
          title={listing.title}
          ratePerDay={Number(listing.rate_cognition_per_day)}
          minDays={listing.min_days}
          isLive={!!listing.mind_id}
        />
      )}

      <div className="notice" style={{ marginTop: 26 }}>
        <b>How renting works:</b> your email is added to this Mind&apos;s Circle for the rental
        window — you talk to the live, trained Mind on web chat{listing.mind_id ? ", email" : " or email"} or
        Telegram. Heads up: a Mind has one shared memory, so treat conversations as visible to its
        steward, and your chats become part of its ongoing training.
      </div>
    </main>
  );
}
