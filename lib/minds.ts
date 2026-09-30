import {
  createMindsClient,
  parseUserIdFromAccessToken,
  type BuilderMind,
  type MindsClient,
} from "@animocabrands/minds-client-lib";
import { RUNWAY_WINDOW_DAYS, type Runway } from "./runway";

/**
 * Per-user Minds clients, authenticated with that user's HelloMinds OAuth
 * access token (see lib/oauth.ts). There is no global account.
 *
 * Access tokens rotate every refresh, so nothing here is keyed by the token
 * itself — that would leak a client and miss every cache on each refresh.
 * Everything is keyed by the token's stable `sub` (the HelloMinds user id).
 */

const userKey = (accessToken: string) => parseUserIdFromAccessToken(accessToken) ?? accessToken.slice(-24);

const clients = new Map<string, { token: string; client: MindsClient }>();
export function mindsFor(accessToken: string): MindsClient {
  const id = userKey(accessToken);
  const hit = clients.get(id);
  if (hit) {
    if (hit.token !== accessToken) {
      hit.client.setAccessToken(accessToken);
      hit.token = accessToken;
    }
    return hit.client;
  }
  const client = createMindsClient({ accessToken });
  clients.set(id, { token: accessToken, client });
  return client;
}

/** 60s mind-list cache per user. */
const listCache = new Map<string, { at: number; items: BuilderMind[] }>();
export async function listMindsFor(accessToken: string): Promise<BuilderMind[]> {
  const cacheKey = userKey(accessToken);
  const hit = listCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;
  const items = await mindsFor(accessToken).listMinds();
  listCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

export type LiveMindStats = {
  balance: number | null;
  /**
   * Cognition burned across the window HelloMinds actually retains.
   * NOT 30 days: the Builder API keeps ~15 daily buckets and silently ignores
   * any earlier `startTime` (verified — 14d, 30d, 60d, 90d and 365d all return
   * the same 15 buckets, and an explicit -60d..-30d window returns none).
   * `usageWindowDays` says how many days this really covers.
   */
  usageWindow: number | null;
  usageWindowDays: number | null;
  skillsCount: number | null;
  /** Cognition runway, same definition as the Core API's /runway endpoint. */
  runway: Runway | null;
};

// Fix 4: 30s cache so a page rendering many Minds doesn't hammer the Builder
// API (and risk rate limits). Keyed per mind; balance staleness of ≤30s is fine.
const statsCache = new Map<string, { at: number; stats: LiveMindStats }>();

export async function getLiveMindStats(accessToken: string, mindId: string): Promise<LiveMindStats> {
  const cacheKey = userKey(accessToken) + ":" + mindId;
  const hit = statsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 30_000) return hit.stats;
  const c = mindsFor(accessToken);
  // Asking for more than the retained window is pointless (see LiveMindStats),
  // so request exactly the runway window and use everything that comes back.
  const startTime = new Date(Date.now() - RUNWAY_WINDOW_DAYS * 86_400_000).toISOString();
  // No getCircle: circles aren't in the OAuth scope catalog, so with HelloMinds
  // login that call can only ever fail.
  const [balance, usage, skills] = await Promise.allSettled([
    c.getCognitionBalance(mindId),
    c.getCognitionUsage(mindId, { interval: "1d", startTime }),
    c.listEquippedSkills(mindId),
  ]);
  const bal = balance.status === "fulfilled" ? Number(balance.value.cognition) : null;

  // One daily bucket per day, dense (a 7-day request returns 8 buckets), so the
  // bucket count IS the number of days covered — no date filtering needed, and
  // no assuming a window length the API didn't actually give us.
  const buckets = usage.status === "fulfilled" ? usage.value.items : [];
  const spent = buckets.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const windowDays = buckets.length;

  // Runway uses the Core API's definition: balance ÷ mean daily spend over the
  // trailing window. Computed here because the native endpoint needs a
  // HelloMinds user session (docs/CORE-API-NOTES.md).
  let runway: Runway | null = null;
  if (bal != null) {
    const perDay = windowDays > 0 ? spent / windowDays : 0;
    runway =
      perDay > 0
        ? {
            mindId,
            status: "estimated",
            runwayDays: Math.round((bal / perDay) * 10) / 10,
            perDay: Math.round(perDay * 10) / 10,
            balance: bal,
            windowDays,
            source: "computed",
          }
        : {
            mindId,
            status: "idle",
            runwayDays: null,
            perDay: null,
            balance: bal,
            windowDays,
            source: "computed",
          };
  }
  const stats = {
    balance: bal,
    usageWindow: usage.status === "fulfilled" ? Math.round(spent) : null,
    usageWindowDays: usage.status === "fulfilled" ? windowDays : null,
    skillsCount: skills.status === "fulfilled" ? skills.value.length : null,
    runway,
  };
  statsCache.set(cacheKey, { at: Date.now(), stats });
  return stats;
}

/**
 * Training Score: age + cognition invested + skills. Capped at 1000.
 * `usageWindow` is whatever the Builder API retained (~15 days) — the value is
 * unchanged from before, only the name was wrong.
 */
export function trainingScore(opts: {
  createdAt?: string | null;
  usageWindow?: number | null;
  skillsCount?: number | null;
}): number {
  const ageDays = opts.createdAt
    ? Math.max(0, (Date.now() - new Date(opts.createdAt).getTime()) / 86_400_000)
    : 0;
  const score = ageDays * 8 + (opts.usageWindow ?? 0) * 0.04 + (opts.skillsCount ?? 0) * 40;
  return Math.min(1000, Math.round(score));
}
