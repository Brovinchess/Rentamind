import Link from "next/link";
import { redirect } from "next/navigation";
import MindAvatar from "@/components/MindAvatar";
import SignOutButton from "@/components/SignOutButton";
import { getAuthedUser } from "@/lib/auth";
import {
  getAllPointsEvents,
  getListing,
  getListingsForSteward,
  getOrCreateWallet,
  getPointsEvents,
  getRentalsByRenter,
  getTrainingPlansForOwner,
} from "@/lib/db";
import { listMindsFor } from "@/lib/minds";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  training: "Training",
  rental_supply: "Rental income",
  renter_usage: "Renting spend",
  bonus: "Bonus",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ trainer?: string }>;
}) {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=/profile");
  const email = user.email;
  await searchParams;

  const [allEvents, recent, wallet, myRentals] = await Promise.all([
    getAllPointsEvents().catch(() => []),
    getPointsEvents(200).catch(() => []),
    getOrCreateWallet(email).catch(() => null),
    getRentalsByRenter(email).catch(() => []),
  ]);
  const [mindsList, listings, plans] = await Promise.all([
    listMindsFor(user.builderKey).catch(() => []),
    getListingsForSteward(email).catch(() => []),
    getTrainingPlansForOwner(email).catch(() => []),
  ]);

  const mine = allEvents.filter((e) => e.subject_email === email);
  const totalPoints = Math.round(mine.reduce((s, e) => s + Number(e.points), 0));
  const myRecent = recent.filter((e) => e.subject_email === email).slice(0, 12);
  const rank =
    [...new Set(allEvents.map((e) => e.subject_email))]
      .map((em) => ({
        em,
        pts: allEvents.filter((e) => e.subject_email === em).reduce((s, e) => s + Number(e.points), 0),
      }))
      .sort((a, b) => b.pts - a.pts)
      .findIndex((r) => r.em === email) + 1;

  const rentalLinks = await Promise.all(
    myRentals.slice(0, 8).map(async (r) => ({
      rental: r,
      listing: await getListing(r.listing_id).catch(() => null),
    })),
  );

  return (
    <main className="container page narrow">
      <span className="eyebrow section-eyebrow">Profile</span>

      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <MindAvatar seed={email} size={72} radius={18} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800 }}>{email.split("@")[0]}</h2>
          <div className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{email}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span className="pill pill-live">Trainer</span>
            <span className="pill pill-cat">Renter</span>
            <span className="pill pill-cat">Season 0</span>
          </div>
        </div>
        <div style={{ textAlign: "right", display: "grid", gap: 8, justifyItems: "end" }}>
          <div>
            <div className="points-big" style={{ fontSize: "1.8rem" }}>{totalPoints.toLocaleString()}</div>
            <div className="mono" style={{ fontSize: "0.65rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
              points{rank ? ` · rank #${rank}` : ""}
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat"><div className="k">Minds</div><div className="v">{mindsList.length}</div></div>
        <div className="stat"><div className="k">In training</div><div className="v">{plans.length}</div></div>
        <div className="stat"><div className="k">Study cycles</div><div className="v">{plans.reduce((s, p) => s + p.study_cycles, 0)}</div></div>
        <div className="stat"><div className="k">Listed for rent</div><div className="v">{listings.filter((l) => l.is_active).length}</div></div>
      </div>

      <h3 style={{ marginTop: 28 }}>Your cognition wallet</h3>
      <div className="stat-grid" style={{ marginTop: 10 }}>
        <div className="stat">
          <div className="k">Balance</div>
          <div className="v">{wallet ? Math.floor(Number(wallet.cognition)).toLocaleString() : "—"}</div>
        </div>
        <div className="stat"><div className="k">Rentals taken</div><div className="v">{myRentals.length}</div></div>
      </div>

      <h3 style={{ marginTop: 28 }}>Your rentals</h3>
      {rentalLinks.length ? (
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Mind</th><th>Status</th><th>Messages</th><th>Spent</th><th></th></tr></thead>
            <tbody>
              {rentalLinks.map(({ rental: r, listing: l }) => {
                const active = r.status === "active" && new Date(r.ends_at) > new Date();
                return (
                  <tr key={r.id}>
                    <td><b>{l?.title ?? "—"}</b></td>
                    <td>{active ? <span className="pill pill-live">active</span> : <span className="pill pill-cat">{r.status}</span>}</td>
                    <td>{r.messages_used}</td>
                    <td>{Math.floor(Number(r.cognition_spent))}</td>
                    <td style={{ textAlign: "right" }}>
                      {active && l ? (
                        <Link href={`/chat/${l.id}?rental=${r.id}`} className="btn btn-primary btn-sm">Chat</Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          You haven&apos;t rented a Mind yet — renting earns 1 point per cognition, and your first 1,000
          cognition is free.{" "}
          <Link href="/marketplace" style={{ color: "var(--brand)", fontWeight: 700 }}>Browse the marketplace →</Link>
        </p>
      )}

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
