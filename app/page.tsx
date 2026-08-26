import Link from "next/link";
import { BookOpen, Coins, Rocket, Store } from "lucide-react";
import { getAllPointsEvents, getListings, getTrainingPlans } from "@/lib/db";

export const dynamic = "force-dynamic";

const JOURNEY = [
  {
    icon: Rocket,
    title: "Launch a Mind",
    body: "Create a Mind on HelloMinds in under a minute. It appears here automatically.",
    href: "/launch",
    cta: "Launch",
  },
  {
    icon: BookOpen,
    title: "Train it into a persona",
    body: "Tell it who to become — Hulk, an F1 champion, a market expert. It studies on repeat, on your schedule. Every study cycle earns you points.",
    href: "/studio",
    cta: "Training Studio",
  },
  {
    icon: Store,
    title: "Rent it out",
    body: "List your trained Mind on the marketplace. Renters pay cognition per message to talk to it — every rental earns you points.",
    href: "/my-minds",
    cta: "My Minds",
  },
  {
    icon: Coins,
    title: "Farm rewards",
    body: "Training, renting out, and renting other people's Minds all earn points toward a future airdrop. Climb the leaderboard.",
    href: "/rewards",
    cta: "Rewards",
  },
];

export default async function Home() {
  const [listings, plans, events] = await Promise.all([
    getListings().catch(() => []),
    getTrainingPlans().catch(() => []),
    getAllPointsEvents().catch(() => []),
  ]);
  const stats = [
    { k: "Minds in training", v: plans.length },
    { k: "Study cycles run", v: plans.reduce((s, p) => s + p.study_cycles, 0) },
    { k: "Minds for rent", v: listings.length },
    { k: "Points issued", v: Math.round(events.reduce((s, e) => s + Number(e.points), 0)).toLocaleString() },
  ];

  return (
    <main>
      <div className="hero">
        <div className="container">
          <span className="eyebrow">Season 0 · points toward a future airdrop</span>
          <h1>Train a Mind. Rent it out. Farm rewards.</h1>
          <p>
            Turn a HelloMinds Mind into a persona anyone would pay to talk to — it studies
            automatically until it thinks and talks like the real thing. Renters pay cognition per
            message, and every bit of activity earns points for both sides.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/marketplace" className="btn btn-primary">Browse Minds for rent</Link>
            <Link href="/studio" className="btn" style={{ border: "1.5px solid rgba(255,255,255,.4)", color: "#fff" }}>
              Start training yours
            </Link>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            {stats.map((s) => (
              <div key={s.k} style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "10px 16px" }}>
                <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{s.v}</div>
                <div className="mono" style={{ fontSize: "0.62rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#c3cdea" }}>{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="page container narrow">
        <span className="eyebrow section-eyebrow">How to farm points</span>
        <h2 className="section-title">Four steps, all of them earn</h2>
        <ol className="journey">
          {JOURNEY.map((s) => (
            <li key={s.title}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <b>{s.title}</b>
                  <div className="sub">{s.body}</div>
                </div>
                <Link href={s.href} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }}>
                  {s.cta}
                </Link>
              </div>
            </li>
          ))}
        </ol>

        <div className="notice" style={{ marginTop: 28 }}>
          <b>Renters farm too:</b> renting someone else&apos;s Mind earns you 1 point per cognition you
          spend — new renters start with 1,000 cognition free. Ask it anything, have it draft in its
          persona&apos;s voice, or ask what its persona would do next.{" "}
          <Link href="/marketplace" style={{ color: "var(--brand)", fontWeight: 700 }}>Find a Mind →</Link>
        </div>
      </section>
    </main>
  );
}
