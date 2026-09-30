import Link from "next/link";
import MindCard from "@/components/MindCard";
import { getAccessTokenForEmail } from "@/lib/auth";
import { getListings } from "@/lib/db";
import { getLiveMindStats, trainingScore } from "@/lib/minds";
import type { Runway } from "@/lib/runway";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All", "Personas", "Experts", "Trading", "Sports", "Culture"];

/** Live score + runway for a listing, read through its owner's HelloMinds connection. */
async function liveFor(
  listing: Listing,
): Promise<{ score: number; runway: Runway | null; offline: boolean }> {
  const fallback = { score: listing.training_score, runway: null, offline: false };
  if (!listing.mind_id) return fallback;
  try {
    const key = await getAccessTokenForEmail(listing.steward_email);
    // Trainer's 30-day HelloMinds connection lapsed: nobody can reach this Mind.
    if (!key) return { ...fallback, offline: true };
    const stats = await getLiveMindStats(key, listing.mind_id);
    return {
      score: trainingScore({
        createdAt: listing.created_at,
        usageWindow: stats.usageWindow,
        skillsCount: stats.skillsCount,
      }),
      runway: stats.runway,
      offline: false,
    };
  } catch {
    return fallback;
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat = "All" } = await searchParams;
  let listings: Listing[] = [];
  let dbError: string | null = null;
  try {
    listings = await getListings();
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }
  const filtered = cat === "All" ? listings : listings.filter((l) => l.category === cat);
  const live = await Promise.all(filtered.map(liveFor));

  return (
    <main>
      <section className="page container" id="browse">
        <span className="eyebrow section-eyebrow">Marketplace</span>
        <h2 className="section-title">Minds for rent</h2>
        <p style={{ color: "var(--muted)", maxWidth: "62ch", marginTop: -8 }}>
          Trained by their trainers, rented by the message. You pay cognition from a rental balance backed
          by your real HelloMinds holdings, and every cognition you spend earns you points.
        </p>

        {dbError ? (
          <div className="notice">
            Database not ready: {dbError}. Run <code className="mono">supabase/schema.sql</code> in
            the Supabase SQL editor, then <code className="mono">npm run seed</code>.
          </div>
        ) : null}

        <div className="filters" style={{ marginTop: 18 }}>
          {CATEGORIES.map((c) => (
            <Link key={c} href={c === "All" ? "/marketplace" : `/marketplace?cat=${c}`} className={c === cat ? "active" : ""}>
              {c}
            </Link>
          ))}
        </div>

        {filtered.length === 0 && !dbError ? (
          <div className="empty">No Minds listed in this category yet.</div>
        ) : (
          <div className="grid">
            {filtered.map((l, i) => (
              <MindCard key={l.id} listing={l} score={live[i].score} runway={live[i].runway} offline={live[i].offline} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
