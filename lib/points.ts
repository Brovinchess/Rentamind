import { getActiveRentals, getListing, updateRental } from "./db";
import { minds } from "./minds";
import type { LeaderboardRow, PointsEvent } from "./types";

export const POINTS = {
  NEW_RENTAL_BONUS: 20, // steward, each time their Mind gets rented
  FIRST_RENTER_BONUS: 50, // steward, per new unique renter
  RENTER_CHECKOUT_BONUS: 10, // renter, on starting a rental
  RENTER_PER_COGNITION: 1, // renter, per cognition they spend using rented Minds
  STEWARD_PER_COGNITION: 0.5, // steward share of what renters spend on their Mind
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
  } catch {
    // background pass — never surface to the page
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
    if (rental.circle_added) {
      // Legacy circle-based rental — revoke the Circle access on expiry.
      const listing = await getListing(rental.listing_id);
      if (listing?.mind_id) {
        try {
          await minds().removeCircleMembers(listing.mind_id, { emails: [rental.renter_email] });
        } catch {
          // best-effort
        }
      }
    }
    await updateRental(rental.id, { status: "expired" });
    expired++;
  }

  return { expired, settled: 0, pointsAwarded: 0 };
}
