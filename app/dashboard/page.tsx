import Link from "next/link";
import ListMindForm from "@/components/ListMindForm";
import SettleButton from "@/components/SettleButton";
import { getListings, getPointsEvents, getRentalsForListing } from "@/lib/db";
import { getLiveMindStats, listMindsCached, STEWARD_EMAIL, trainingScore } from "@/lib/minds";
import type { Rental } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  let liveError: string | null = null;
  let mindRows: {
    mindId: string;
    name: string;
    isEnabled: boolean;
    createdAt: string | null;
    balance: number | null;
    usage30d: number | null;
    circleSize: number | null;
    score: number;
  }[] = [];

  try {
    const live = await listMindsCached();
    mindRows = await Promise.all(
      live.map(async (m) => {
        const stats = await getLiveMindStats(m.mindId);
        return {
          mindId: m.mindId,
          name: m.name ?? "unnamed",
          isEnabled: !!m.isEnabled,
          createdAt: m.createdAt ?? null,
          balance: stats.balance,
          usage30d: stats.usage30d,
          circleSize: stats.circleSize,
          score: trainingScore({ createdAt: m.createdAt, usage30d: stats.usage30d, skillsCount: stats.skillsCount }),
        };
      }),
    );
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e);
  }

  const listings = await getListings().catch(() => []);
  const myListings = listings.filter((l) => l.steward_email === STEWARD_EMAIL);
  const listedMindIds = new Set(listings.map((l) => l.mind_id));
  const unlisted = mindRows.filter((m) => !listedMindIds.has(m.mindId));

  const rentalsByListing = new Map<string, Rental[]>();
  for (const l of myListings) {
    rentalsByListing.set(l.id, await getRentalsForListing(l.id).catch(() => []));
  }

  const events = await getPointsEvents(500).catch(() => []);
  const myPoints = Math.round(
    events.filter((e) => e.subject_email === STEWARD_EMAIL).reduce((s, e) => s + Number(e.points), 0),
  );

  return (
    <main className="container page">
      <span className="eyebrow section-eyebrow">Steward Dashboard</span>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Signed in as {STEWARD_EMAIL}</h2>
        <span className="pill pill-live"><span className="dot" /> Builder API connected</span>
        <span className="score" style={{ fontSize: "1rem" }}>{myPoints.toLocaleString()} Synapses</span>
        <span style={{ marginLeft: "auto" }}><SettleButton /></span>
      </div>

      {liveError ? (
        <div className="notice">Couldn&apos;t reach the HelloMinds Builder API: {liveError}</div>
      ) : null}

      <h3 style={{ marginTop: 30 }}>Your Minds (live from HelloMinds)</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Mind</th><th>Status</th><th>Training Score</th><th>Cognition balance</th>
              <th>Burn · 30d</th><th>Circle</th><th>Listing</th><th>Chat</th>
            </tr>
          </thead>
          <tbody>
            {mindRows.map((m) => {
              const listing = listings.find((l) => l.mind_id === m.mindId);
              return (
                <tr key={m.mindId}>
                  <td><b>@{m.name}</b></td>
                  <td>{m.isEnabled ? <span className="pill pill-live">online</span> : <span className="pill pill-demo">paused</span>}</td>
                  <td className="mono">{m.score}</td>
                  <td>{m.balance != null ? Math.round(m.balance).toLocaleString() : "—"}</td>
                  <td>{m.usage30d != null ? m.usage30d.toLocaleString() : "—"}</td>
                  <td>{m.circleSize ?? "—"}</td>
                  <td>
                    {listing ? (
                      <Link href={`/mind/${listing.id}`} style={{ color: "var(--brand)", fontWeight: 700 }}>
                        {listing.title} →
                      </Link>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>not listed</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/talk/${m.mindId}`} className="btn btn-outline btn-sm">
                      Talk
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!mindRows.length && !liveError ? (
              <tr><td colSpan={8} className="empty">Loading live Minds…</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ListMindForm minds={unlisted.map((m) => ({ mindId: m.mindId, name: m.name }))} />
        <Link href="/launch" className="btn btn-outline">
          Launch a new Mind
        </Link>
      </div>

      <h3 style={{ marginTop: 38 }}>Rentals on your listings</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr><th>Listing</th><th>Renter</th><th>Window</th><th>Status</th><th>Cognition used</th><th>Circle</th></tr>
          </thead>
          <tbody>
            {myListings.flatMap((l) =>
              (rentalsByListing.get(l.id) ?? []).map((r) => (
                <tr key={r.id}>
                  <td><b>{l.title}</b></td>
                  <td>{r.renter_email}</td>
                  <td className="mono" style={{ fontSize: "0.78rem" }}>
                    {new Date(r.starts_at).toLocaleDateString()} → {new Date(r.ends_at).toLocaleDateString()}
                  </td>
                  <td>
                    {r.status === "active"
                      ? <span className="pill pill-live">active</span>
                      : <span className="pill pill-cat">{r.status}</span>}
                  </td>
                  <td>{Math.round(Number(r.cognition_used)).toLocaleString()}</td>
                  <td>{r.circle_added ? "granted" : "—"}</td>
                </tr>
              )),
            )}
            {myListings.every((l) => !(rentalsByListing.get(l.id) ?? []).length) ? (
              <tr><td colSpan={6} className="empty">No rentals yet — share a listing to get your first renter.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 26 }}>
        <b>Demo note:</b> this dashboard is a single-steward demo signed in with Rovin&apos;s Builder
        API key. Balances, usage, circles, and listings marked <i>live</i> come straight from
        HelloMinds; &quot;Settle rentals&quot; runs the metering/expiry pass a cron would run in production.
      </div>
    </main>
  );
}
