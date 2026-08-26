import Link from "next/link";
import MindCard from "@/components/MindCard";
import { getBuilderKeyForEmail } from "@/lib/auth";
import { getListings } from "@/lib/db";
import { getLiveMindStats, trainingScore } from "@/lib/minds";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All", "Personas", "Experts", "Trading", "Sports", "Culture"];

async function scoreFor(listing: Listing): Promise<number> {
  if (!listing.mind_id) return listing.training_score;
  try {
    const key = await getBuilderKeyForEmail(listing.steward_email);
    if (!key) return listing.training_score;
    const stats = await getLiveMindStats(key, listing.mind_id);
    return trainingScore({
      createdAt: listing.created_at,
      usage30d: stats.usage30d,
      skillsCount: stats.skillsCount,
    });
  } catch {
    return listing.training_score;
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
  const scores = await Promise.all(filtered.map(scoreFor));

  return (
    <main>
      <section className="page container" id="browse">
        <span className="eyebrow section-eyebrow">Marketplace</span>
        <h2 className="section-title">Minds for rent</h2>
        <p style={{ color: "var(--muted)", maxWidth: "62ch", marginTop: -8 }}>
          Trained by their trainers, rented by the message. You pay cognition from your balance
          (1,000 free to start) and every cognition you spend earns you points.
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
              <MindCard key={l.id} listing={l} score={scores[i]} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
