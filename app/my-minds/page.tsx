import MindsNav from "@/components/MindsNav";
import Link from "next/link";
import { after } from "next/server";
import ListMindForm from "@/components/ListMindForm";
import MindAvatar from "@/components/MindAvatar";
import ManageListings from "@/components/ManageListings";
import SettleButton from "@/components/SettleButton";
import { settleIfStale } from "@/lib/points";
import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/auth";
import { connectionStatus } from "@/lib/oauth";
import { getAllPointsEvents, getListingsForSteward, getRentalsForListing } from "@/lib/db";
import RunwayBadge from "@/components/RunwayBadge";
import TopUpPanel from "@/components/TopUpPanel";
import { MIN_MIND_COGNITION } from "@/lib/mind-health";
import { getLiveMindStats, listMindsFor, trainingScore } from "@/lib/minds";
import type { Runway } from "@/lib/runway";
import type { Rental } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getAuthedUser();
  if (!user) redirect("/login?next=/my-minds");
  after(settleIfStale); // keep rentals settled between cron runs
  let liveError: string | null = null;
  let mindRows: {
    mindId: string;
    name: string;
    isEnabled: boolean;
    createdAt: string | null;
    balance: number | null;
    usageWindow: number | null;
    usageWindowDays: number | null;
    runway: Runway | null;
    score: number;
  }[] = [];

  try {
    const live = await listMindsFor(user.accessToken);
    mindRows = await Promise.all(
      live.map(async (m) => {
        const stats = await getLiveMindStats(user.accessToken, m.mindId);
        return {
          mindId: m.mindId,
          name: m.name ?? "unnamed",
          isEnabled: !!m.isEnabled,
          createdAt: m.createdAt ?? null,
          balance: stats.balance,
          usageWindow: stats.usageWindow,
          usageWindowDays: stats.usageWindowDays,
          runway: stats.runway,
          score: trainingScore({ createdAt: m.createdAt, usageWindow: stats.usageWindow, skillsCount: stats.skillsCount }),
        };
      }),
    );
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e);
  }

  // Minds that will go quiet soon — nearly out of cognition, or under four days
  // of runway at their current burn. Most urgent first; a long tail here is
  // noise, so we surface the worst few and count the rest.
  const LOW_RUNWAY_DAYS = 4;
  const atRisk = mindRows
    .filter(
      (m) =>
        (m.balance != null && m.balance < MIN_MIND_COGNITION * 3) ||
        (m.runway?.status === "estimated" && (m.runway.runwayDays ?? Infinity) < LOW_RUNWAY_DAYS),
    )
    .sort((a, b) => (a.runway?.runwayDays ?? Infinity) - (b.runway?.runwayDays ?? Infinity));
  const needsFuel = atRisk.slice(0, 5);
  const alsoAtRisk = atRisk.length - needsFuel.length;

  const connection = await connectionStatus(user.humanId);
  const myListings = await getListingsForSteward(user.email).catch(() => []);
  const listedMindIds = new Set(myListings.map((l) => l.mind_id));
  const unlisted = mindRows.filter((m) => !listedMindIds.has(m.mindId));

  const rentalsByListing = new Map<string, Rental[]>();
  for (const l of myListings) {
    rentalsByListing.set(l.id, await getRentalsForListing(l.id).catch(() => []));
  }

  // All events, not the latest N: a capped read silently undercounts once the
  // table grows (it showed 2,450 of a real 3,852). Matches the profile page.
  const events = await getAllPointsEvents().catch(() => []);
  const myPoints = Math.round(
    events.filter((e) => e.subject_email === user.email).reduce((s, e) => s + Number(e.points), 0),
  );

  return (
    <main className="container page">
      <MindsNav active="/my-minds" />
      <span className="eyebrow section-eyebrow">My Minds</span>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <h2 className="section-title" style={{ margin: 0 }}>Trainer: {user.email}</h2>
        {connection.expiringSoon ? (
          <Link href="/login?next=/my-minds" className="pill pill-dry" style={{ textDecoration: "none" }}>
            Reconnect HelloMinds — {Math.max(0, Math.ceil(connection.daysLeft ?? 0))}d left
          </Link>
        ) : (
          <span className="pill pill-live"><span className="dot" /> Connected to HelloMinds</span>
        )}
        <span className="score" style={{ fontSize: "1rem" }}>{myPoints.toLocaleString()} points</span>
        <span style={{ marginLeft: "auto" }}><SettleButton /></span>
      </div>

      {liveError ? (
        <div className="notice">Couldn&apos;t reach HelloMinds: {liveError}</div>
      ) : null}

      <h3 style={{ marginTop: 30 }}>Your Minds (live from HelloMinds)</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Mind</th><th>Status</th><th>Runway</th><th>Training Score</th><th>Cognition balance</th>
              <th title="Cognition burned over the history HelloMinds retains — about 15 days, less for a young Mind. Hover a figure for its exact window.">
                Burn · recent
              </th><th>Listing</th><th>Chat</th>
            </tr>
          </thead>
          <tbody>
            {mindRows.map((m) => {
              const listing = myListings.find((l) => l.mind_id === m.mindId && l.is_active);
              return (
                <tr key={m.mindId}>
                  <td><span style={{ display: "flex", alignItems: "center", gap: 8 }}><MindAvatar seed={m.name} size={26} radius={7} /><b>@{m.name}</b></span></td>
                  <td>{m.isEnabled ? <span className="pill pill-live">online</span> : <span className="pill pill-demo">paused</span>}</td>
                  <td><RunwayBadge runway={m.runway} /></td>
                  <td className="mono">{m.score}</td>
                  <td>{m.balance != null ? Math.round(m.balance).toLocaleString() : "—"}</td>
                  <td title={m.usageWindowDays ? `over the last ${m.usageWindowDays} days` : undefined}>
                    {m.usageWindow != null ? m.usageWindow.toLocaleString() : "—"}
                    {m.usageWindowDays ? (
                      <small style={{ color: "var(--muted)", fontWeight: 600 }}> /{m.usageWindowDays}d</small>
                    ) : null}
                  </td>
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

      {needsFuel.length ? (
        <>
          <h3 style={{ marginTop: 34 }}>Running low on cognition</h3>
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: -6 }}>
            A Mind with no cognition can&apos;t study or answer renters. These are the closest to
            empty
            {alsoAtRisk > 0 ? ` — ${alsoAtRisk} more are under ${LOW_RUNWAY_DAYS} days too` : ""}.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {needsFuel.map((m) => (
              <div className="card" key={m.mindId} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <MindAvatar seed={m.name} size={30} radius={8} />
                  <b>@{m.name}</b>
                  <RunwayBadge runway={m.runway} />
                  <span className="mono" style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                    {m.balance != null ? `${Math.round(m.balance).toLocaleString()} cognition left` : ""}
                  </span>
                </div>
                <TopUpPanel mindId={m.mindId} mindName={m.name} />
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <ListMindForm minds={unlisted.map((m) => ({ mindId: m.mindId, name: m.name }))} />
        <Link href="/launch" className="btn btn-outline">
          Launch a new Mind
        </Link>
      </div>

      {myListings.length ? (
        <>
          <h3 style={{ marginTop: 38 }}>Your listings</h3>
          <div style={{ marginTop: 10 }}>
            <ManageListings
              listings={myListings.map((l) => ({
                id: l.id,
                title: l.title,
                mind_name: l.mind_name,
                tagline: l.tagline,
                description: l.description,
                category: l.category,
                emoji: l.emoji,
                label: l.label,
                price_per_message: Number(l.price_per_message),
                min_days: l.min_days,
                max_concurrent: l.max_concurrent,
                is_active: l.is_active,
                activeRentals: (rentalsByListing.get(l.id) ?? []).filter((r) => r.status === "active").length,
              }))}
            />
          </div>
        </>
      ) : null}

      <h3 style={{ marginTop: 38 }}>Rentals on your listings</h3>
      <div className="table-wrap" style={{ marginTop: 10 }}>
        <table>
          <thead>
            <tr><th>Listing</th><th>Renter</th><th>Window</th><th>Status</th><th>Cognition used</th></tr>
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
                </tr>
              )),
            )}
            {myListings.every((l) => !(rentalsByListing.get(l.id) ?? []).length) ? (
              <tr><td colSpan={5} className="empty">No rentals yet — share a listing to get your first renter.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 26 }}>
        Balances, usage, circles, and listings come straight from your HelloMinds account.
        &quot;Settle rentals&quot; runs the expiry pass early; a cron runs it automatically.
      </div>
    </main>
  );
}
