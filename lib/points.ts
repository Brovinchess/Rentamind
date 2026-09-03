import { getActiveRentals, updateRental } from "./db";
import type { LeaderboardRow, PointsEvent } from "./types";

export const SEASON = "0";

/**
 * Points are SPEND-BASED. Every point must be backed by real cognition actually
 * spent — so "farming" is just paying to play, which is the goal, and there are
 * no free/flat bonuses to exploit with throwaway accounts.
 */
export const POINTS = {
  RENTER_PER_COGNITION: 1, // renter, per cognition they spend on rented Minds
  STEWARD_PER_COGNITION: 0.5, // steward's share of what renters spend on their Mind
  NEW_PAYING_RENTER_BONUS: 25, // steward, once per rental, on the renter's FIRST paid message (spend-gated)
};

export function aggregateLeaderboard(events: Pick<PointsEvent, "subject_email" | "subject_name" | "points">[]): LeaderboardRow[] {
  const map = new Map<string, { name: string; points: number }>();
  for (const e of events) {
    const cur = map.get(e.subject_email) ?? { name: e.subject_name ?? e.subject_email, points: 0 };
    cur.points += Number(e.points);
    if (e.subject_name) cur.name = e.subject_name;
    map.set(e.subject_email, cur);
  }
  return [...map.entries()]
    .map(([email, v]) => ({ email, name: v.name, points: Math.round(v.points) }))
    .sort((a, b) => b.points - a.points)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Throttled background settlement: runs at most once per THROTTLE_MS per server
 * instance. Called via `after()` on page visits so settlement stays fresh between
 * the daily cron runs (Hobby-plan crons fire only once a day).
 */
const SETTLE_THROTTLE_MS = 10 * 60 * 1000;
let lastSettleAt = 0;
export async function settleIfStale(): Promise<void> {
  const now = Date.now();
  if (now - lastSettleAt < SETTLE_THROTTLE_MS) return;
  lastSettleAt = now;
  try {
    await settle();
    const { runDueStudies } = await import("./study");
    await runDueStudies();
  } catch (e) {
    // background pass — don't surface to the page, but log so a stalled loop is visible in ops.
    console.error("[settleIfStale] background pass failed:", e);
  }
}

/**
 * Settlement pass: expire rentals past their window.
 * v2: usage points are awarded per message at chat time (exact, per renter), so
 * settle only handles expiry — plus circle removal for any legacy circle-based rental.
 */
export async function settle(): Promise<{ expired: number; settled: number; pointsAwarded: number }> {
  const active = await getActiveRentals();
  const now = new Date();
  let expired = 0;

  for (const rental of active) {
    if (new Date(rental.ends_at) > now) continue;
    await updateRental(rental.id, { status: "expired" });
    expired++;
  }

  return { expired, settled: 0, pointsAwarded: 0 };
}
