import { addPoints, getActiveRentals, getListing, updateRental } from "./db";
import { minds, usageBetween } from "./minds";
import type { LeaderboardRow, PointsEvent } from "./types";

export const POINTS = {
  RENTAL_SUPPLY_PER_DAY: 20, // steward, per rented day at checkout
  FIRST_RENTER_BONUS: 50, // steward, per new unique renter
  RENTER_CHECKOUT_BONUS: 10, // renter, on checkout
  RENTER_PER_COGNITION: 1, // renter, per cognition burned during rental
  STEWARD_PER_COGNITION: 0.5, // steward share of renter burn
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
 * Lazy settlement pass (demo stand-in for a cron):
 * - expire active rentals past their window (real circle removal when applicable)
 * - meter cognition burned during each live rental window and award usage points
 */
export async function settle(): Promise<{ expired: number; settled: number; pointsAwarded: number }> {
  const active = await getActiveRentals();
  const now = new Date();
  let expired = 0;
  let settled = 0;
  let pointsAwarded = 0;

  for (const rental of active) {
    const listing = await getListing(rental.listing_id);
    if (!listing) continue;

    // 1. Usage metering for live minds (window since last settle)
    if (listing.mind_id) {
      const from = new Date(rental.usage_settled_at ?? rental.starts_at);
      const to = now < new Date(rental.ends_at) ? now : new Date(rental.ends_at);
      if (to > from) {
        try {
          const used = await usageBetween(listing.mind_id, from, to);
          if (used > 0.5) {
            const renterPts = Math.round(used * POINTS.RENTER_PER_COGNITION);
            const stewardPts = Math.round(used * POINTS.STEWARD_PER_COGNITION);
            await addPoints([
              {
                subject_email: rental.renter_email,
                role: "renter",
                event_type: "renter_usage",
                points: renterPts,
                meta: { rentalId: rental.id, listing: listing.title, cognition: used },
              },
              {
                subject_email: listing.steward_email,
                subject_name: listing.steward_name,
                role: "steward",
                event_type: "rental_supply",
                points: stewardPts,
                meta: { rentalId: rental.id, listing: listing.title, cognition: used },
              },
            ]);
            pointsAwarded += renterPts + stewardPts;
          }
          await updateRental(rental.id, {
            cognition_used: Number(rental.cognition_used) + used,
            usage_settled_at: now.toISOString(),
          });
          settled++;
        } catch {
          // metering is best-effort in the demo
        }
      }
    }

    // 2. Expiry — remove renter from the circle when the window closes
    if (new Date(rental.ends_at) <= now) {
      if (listing.mind_id && rental.circle_added) {
        try {
          await minds().removeCircleMembers(listing.mind_id, { emails: [rental.renter_email] });
        } catch {
          // best-effort; surfaced in dashboard as still-active circle membership
        }
      }
      await updateRental(rental.id, { status: "expired" });
      expired++;
    }
  }

  return { expired, settled, pointsAwarded };
}
