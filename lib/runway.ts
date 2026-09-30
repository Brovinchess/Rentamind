/**
 * Cognition runway — "how many days until this Mind runs dry".
 *
 * We use the definition the HelloMinds Core API documents for
 * `GET /v1/minds/{mindId}/runway`:
 *
 *   balance ÷ average daily spend over a trailing window
 *   status "estimated" when there is spend in the window, "idle" when there isn't
 *
 * We compute it in `getLiveMindStats` (lib/minds.ts) from Builder-API usage
 * rather than calling that endpoint, because the Core endpoint needs a
 * HelloMinds user session a third-party app can't obtain (docs/CORE-API-NOTES.md).
 * Keeping the same shape means swapping in the native call later touches one
 * function.
 *
 * This module stays free of imports on purpose: `lib/minds.ts` imports it, so
 * importing anything back from there would create a module cycle (it did once —
 * it hung every page that pulled both in).
 */

/**
 * Window we ask for. The Builder API only retains ~15 daily buckets and
 * silently ignores any earlier `startTime`, so asking for more is pointless —
 * the actual span is reported per Mind as `windowDays`.
 */
export const RUNWAY_WINDOW_DAYS = 14;

export type Runway = {
  mindId: string;
  /** "estimated" when a burn rate is available; "idle" when nothing was spent. */
  status: "estimated" | "idle";
  /** Days of cognition left at the recent burn rate. Null when idle. */
  runwayDays: number | null;
  /** Average daily cognition spend across the window. Null when idle. */
  perDay: number | null;
  balance: number;
  /** Days the usage data actually covered — not assumed, counted. */
  windowDays: number;
  /** How this was produced, so the UI can be honest about it. */
  source: "computed";
};

/** Short human label: "12 days left", "idle", "dry". */
export function runwayLabel(r: Runway | null): string {
  if (!r) return "unknown";
  if (r.balance <= 0) return "dry";
  if (r.status === "idle") return "idle";
  const d = r.runwayDays ?? 0;
  if (d < 1) return "under a day left";
  return `${d < 10 ? d : Math.round(d)} days left`;
}

/** Traffic light for runway, used for badge colouring. */
export function runwayTone(r: Runway | null): "good" | "warn" | "bad" | "none" {
  if (!r || r.balance <= 0) return r ? "bad" : "none";
  if (r.status === "idle") return "none";
  const d = r.runwayDays ?? 0;
  if (d < 2) return "bad";
  if (d < 7) return "warn";
  return "good";
}
