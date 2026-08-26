import Link from "next/link";
import { Star } from "lucide-react";
import MindAvatar from "@/components/MindAvatar";
import type { Listing } from "@/lib/types";

export function Stars({ rating, count }: { rating: number; count?: number }) {
  if (!rating) return <span className="stars" style={{ color: "var(--muted)" }}>unrated</span>;
  const full = Math.round(rating);
  return (
    <span className="stars" title={`${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={13}
          strokeWidth={1.8}
          fill={i < full ? "currentColor" : "none"}
          aria-hidden
        />
      ))}
      {count ? <span style={{ color: "var(--muted)", marginLeft: 4 }}>({count})</span> : null}
    </span>
  );
}

export function LiveBadge({ live }: { live: boolean }) {
  return live ? (
    <span className="pill pill-live"><span className="dot" /> Live Mind</span>
  ) : (
    <span className="pill pill-demo">Seeded demo</span>
  );
}

export default function MindCard({ listing, score }: { listing: Listing; score?: number }) {
  const ts = score ?? listing.training_score;
  return (
    <Link href={`/mind/${listing.id}`} className="card mind-card">
      <div className="top">
        <MindAvatar seed={listing.title} size={46} radius={12} />
        <div>
          <h3>{listing.title}</h3>
          <span className="handle">@{listing.mind_name} · by {listing.steward_name}</span>
        </div>
      </div>
      <p className="tagline">{listing.tagline}</p>
      <div className="meta-row">
        <LiveBadge live={!!listing.mind_id} />
        {listing.label ? <span className="pill pill-label">{listing.label}</span> : null}
        <span className="pill pill-cat">{listing.category}</span>
      </div>
      <div className="meta-row">
        <span className="score">TS {ts}</span>
        <Stars rating={Number(listing.rating)} count={listing.rating_count} />
      </div>
      <div className="foot">
        <span className="price">
          {Number(listing.price_per_message).toLocaleString()} <small>Cognition / message</small>
        </span>
        <span className="btn btn-primary btn-sm">Rent</span>
      </div>
    </Link>
  );
}
