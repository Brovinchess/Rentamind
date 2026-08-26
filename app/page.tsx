import Link from "next/link";
import MindCard from "@/components/MindCard";
import { getListings } from "@/lib/db";
import { getLiveMindStats, trainingScore } from "@/lib/minds";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORIES = ["All", "Personas", "Experts", "Trading", "Sports", "Culture"];

async function scoreFor(listing: Listing): Promise<number> {
  if (!listing.mind_id) return listing.training_score;
  try {
    const stats = await getLiveMindStats(listing.mind_id);
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
      <div className="hero">
        <div className="container">
          <span className="eyebrow">A marketplace for trained Minds</span>
          <h1>Someone already trained the Mind you need.</h1>
          <p>
            Stewards train their Minds into personas and specialists. Rent one and it answers you,
            drafts in its voice, and predicts what its persona would do — every cognition you spend
            earns points for both sides.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="#browse" className="btn btn-primary">Browse Minds</a>
            <Link href="/dashboard" className="btn" style={{ border: "1.5px solid rgba(255,255,255,.4)", color: "#fff" }}>
              Rent out yours
            </Link>
          </div>
        </div>
      </div>

      <section className="page container" id="browse">
        <span className="eyebrow section-eyebrow">The Mindshelf</span>
        <h2 className="section-title">Minds for rent</h2>

        {dbError ? (
          <div className="notice">
            Database not ready: {dbError}. Run <code className="mono">supabase/schema.sql</code> in
            the Supabase SQL editor, then <code className="mono">npm run seed</code>.
          </div>
        ) : null}

        <div className="filters">
          {CATEGORIES.map((c) => (
            <Link key={c} href={c === "All" ? "/" : `/?cat=${c}`} className={c === cat ? "active" : ""}>
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
