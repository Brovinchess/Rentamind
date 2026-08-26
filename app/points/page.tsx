import { after } from "next/server";
import { getAllPointsEvents, getPointsEvents } from "@/lib/db";
import { aggregateLeaderboard, settleIfStale } from "@/lib/points";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  training: "Training",
  rental_supply: "Rental supply",
  renter_usage: "Rented usage",
  bonus: "Bonus",
  seed: "Pre-season",
};

export default async function PointsPage() {
  after(settleIfStale); // keep rentals settled between daily cron runs
  const [all, recent] = await Promise.all([
    getAllPointsEvents().catch(() => []),
    getPointsEvents(30).catch(() => []),
  ]);
  const board = aggregateLeaderboard(all);

  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Season 0</span>
      <h2 className="section-title">Synapses leaderboard</h2>
      <p style={{ color: "var(--muted)", maxWidth: "62ch" }}>
        Synapses are burn-backed points: training your Mind, renting it out, and using rented Minds
        all earn them. They accrue toward a future airdrop. Self-rental loops decay to zero — only
        real demand climbs this board.
      </p>

      <div className="table-wrap" style={{ margin: "18px 0 36px" }}>
        <table>
          <thead>
            <tr><th>Rank</th><th>Steward / Renter</th><th style={{ textAlign: "right" }}>Synapses</th></tr>
          </thead>
          <tbody>
            {board.map((r) => (
              <tr key={r.email}>
                <td className={`rank ${r.rank === 1 ? "rank-1" : ""}`}>#{r.rank}</td>
                <td>
                  <b>{r.name}</b>{" "}
                  <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{r.email}</span>
                </td>
                <td className="points-big" style={{ textAlign: "right" }}>{r.points.toLocaleString()}</td>
              </tr>
            ))}
            {!board.length ? <tr><td colSpan={3} className="empty">No points yet — run the seed script.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <h3>Recent activity</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr><th>When</th><th>Who</th><th>Type</th><th style={{ textAlign: "right" }}>Points</th></tr>
          </thead>
          <tbody>
            {recent.filter((e) => e.event_type !== "seed").map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ fontSize: "0.75rem" }}>{new Date(e.created_at).toLocaleString()}</td>
                <td>{e.subject_name ?? e.subject_email}</td>
                <td>
                  <span className="pill pill-cat">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>{" "}
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    {typeof e.meta?.listing === "string" ? e.meta.listing : ""}
                  </span>
                </td>
                <td className="points-big" style={{ textAlign: "right" }}>+{Math.round(Number(e.points))}</td>
              </tr>
            ))}
            {recent.filter((e) => e.event_type !== "seed").length === 0 ? (
              <tr><td colSpan={4} className="empty">No live activity yet — rent a Mind to earn the first Synapses.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
