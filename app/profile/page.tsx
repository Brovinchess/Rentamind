import Link from "next/link";
import MindAvatar from "@/components/MindAvatar";
import {
  getAllPointsEvents,
  getListingsForSteward,
  getOrCreateWallet,
  getPointsEvents,
  getRentalsByRenter,
  getTrainingPlans,
} from "@/lib/db";
import { listMindsCached, STEWARD_EMAIL } from "@/lib/minds";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  training: "Training",
  rental_supply: "Rental income",
  renter_usage: "Renting spend",
  bonus: "Bonus",
};

export default async function ProfilePage() {
  const [mindsList, listings, plans, allEvents, recent, wallet, myRentals] = await Promise.all([
    listMindsCached().catch(() => []),
    getListingsForSteward(STEWARD_EMAIL).catch(() => []),
    getTrainingPlans().catch(() => []),
    getAllPointsEvents().catch(() => []),
    getPointsEvents(200).catch(() => []),
    getOrCreateWallet(STEWARD_EMAIL).catch(() => null),
    getRentalsByRenter(STEWARD_EMAIL).catch(() => []),
  ]);

  const mine = allEvents.filter((e) => e.subject_email === STEWARD_EMAIL);
  const totalPoints = Math.round(mine.reduce((s, e) => s + Number(e.points), 0));
  const myRecent = recent.filter((e) => e.subject_email === STEWARD_EMAIL).slice(0, 12);

  const breakdown = ["training", "rental_supply", "renter_usage", "bonus"].map((t) => ({
    type: t,
    label: EVENT_LABEL[t],
    points: Math.round(
      recent.filter((e) => e.subject_email === STEWARD_EMAIL && e.event_type === t).reduce((s, e) => s + Number(e.points), 0),
    ),
  }));

  const rank =
    [...new Set(allEvents.map((e) => e.subject_email))]
      .map((email) => ({
        email,
        pts: allEvents.filter((e) => e.subject_email === email).reduce((s, e) => s + Number(e.points), 0),
      }))
      .sort((a, b) => b.pts - a.pts)
      .findIndex((r) => r.email === STEWARD_EMAIL) + 1;

  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Profile</span>

      {/* identity card */}
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <MindAvatar seed={STEWARD_EMAIL} size={72} radius={18} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>Rovin</h2>
          <div className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{STEWARD_EMAIL}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="pill pill-live">Builder API connected</span>
            <span className="pill pill-cat">Season 0</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="points-big" style={{ fontSize: "1.8rem" }}>{totalPoints.toLocaleString()}</div>
          <div className="mono" style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
            points · rank #{rank || "—"}
          </div>
        </div>
      </div>

      {/* trainer stats */}
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat"><div className="k">Minds</div><div className="v">{mindsList.length}</div></div>
        <div className="stat"><div className="k">In training</div><div className="v">{plans.length}</div></div>
        <div className="stat"><div className="k">Study cycles</div><div className="v">{plans.reduce((s, p) => s + p.study_cycles, 0)}</div></div>
        <div className="stat"><div className="k">Listed for rent</div><div className="v">{listings.filter((l) => l.is_active).length}</div></div>
      </div>

      {/* points breakdown */}
      <h3 style={{ marginTop: 28 }}>Where your points come from</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Source</th><th style={{ textAlign: "right" }}>Points</th></tr></thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.type}>
                <td>{b.label}</td>
                <td className="points-big" style={{ textAlign: "right" }}>{b.points.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* renter side */}
      <h3 style={{ marginTop: 28 }}>Your renter side</h3>
      <div className="stat-grid" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="k">Cognition balance</div>
          <div className="v">{wallet ? Math.floor(Number(wallet.cognition)).toLocaleString() : "—"}</div>
        </div>
        <div className="stat"><div className="k">Rentals taken</div><div className="v">{myRentals.length}</div></div>
      </div>
      {myRentals.length ? (
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Rental</th><th>Status</th><th>Messages</th><th>Spent</th></tr></thead>
            <tbody>
              {myRentals.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: "0.75rem" }}>{new Date(r.starts_at).toLocaleDateString()}</td>
                  <td>{r.status === "active" ? <span className="pill pill-live">active</span> : <span className="pill pill-cat">{r.status}</span>}</td>
                  <td>{r.messages_used}</td>
                  <td>{Math.floor(Number(r.cognition_spent))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          You haven&apos;t rented anyone else&apos;s Mind yet — renting earns 1 point per cognition.{" "}
          <Link href="/marketplace" style={{ color: "var(--brand)", fontWeight: 700 }}>Browse the marketplace →</Link>
        </p>
      )}

      {/* recent activity */}
      <h3 style={{ marginTop: 28 }}>Recent activity</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>When</th><th>What</th><th style={{ textAlign: "right" }}>Points</th></tr></thead>
          <tbody>
            {myRecent.map((e) => (
              <tr key={e.id}>
                <td className="mono" style={{ fontSize: "0.75rem" }}>{new Date(e.created_at).toLocaleString()}</td>
                <td>
                  <span className="pill pill-cat">{EVENT_LABEL[e.event_type] ?? e.event_type}</span>{" "}
                  <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                    {typeof e.meta?.persona === "string" ? e.meta.persona : typeof e.meta?.listing === "string" ? e.meta.listing : ""}
                  </span>
                </td>
                <td className="points-big" style={{ textAlign: "right" }}>+{Math.round(Number(e.points))}</td>
              </tr>
            ))}
            {!myRecent.length ? <tr><td colSpan={3} className="empty">No activity yet.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
        <Link href="/my-minds" className="btn btn-outline btn-sm">My Minds</Link>
        <Link href="/studio" className="btn btn-outline btn-sm">Training Studio</Link>
        <Link href="/rewards" className="btn btn-outline btn-sm">Leaderboard</Link>
      </div>
    </main>
  );
}
