import { createMindsClient, type MindsClient, type BuilderMind } from "@animocabrands/minds-client-lib";

let _client: MindsClient | null = null;

export function minds(): MindsClient {
  if (!_client) {
    const builderApiKey = process.env.MINDS_BUILDER_API_KEY;
    if (!builderApiKey) throw new Error("MINDS_BUILDER_API_KEY is not set");
    _client = createMindsClient({ builderApiKey });
  }
  return _client;
}

export const STEWARD_EMAIL = process.env.MINDS_STEWARD_EMAIL ?? "rovin@anichess.com";

/** Live mind list, cached for 60s per server process (demo-friendly). */
let mindsCache: { at: number; items: BuilderMind[] } | null = null;
export async function listMindsCached(): Promise<BuilderMind[]> {
  if (mindsCache && Date.now() - mindsCache.at < 60_000) return mindsCache.items;
  const items = await minds().listMinds();
  mindsCache = { at: Date.now(), items };
  return items;
}

export type LiveMindStats = {
  balance: number | null;
  usage30d: number | null;
  circleSize: number | null;
  skillsCount: number | null;
};

/** Best-effort live stats for a mind; nulls where a call fails. */
export async function getLiveMindStats(mindId: string): Promise<LiveMindStats> {
  const c = minds();
  const startTime = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [balance, usage, circle, skills] = await Promise.allSettled([
    c.getCognitionBalance(mindId),
    c.getCognitionUsage(mindId, { interval: "1d", startTime }),
    c.getCircle(mindId),
    c.listEquippedSkills(mindId),
  ]);
  return {
    balance: balance.status === "fulfilled" ? balance.value.cognition : null,
    usage30d:
      usage.status === "fulfilled"
        ? Math.round(usage.value.items.reduce((s, i) => s + (i.value ?? 0), 0))
        : null,
    circleSize: circle.status === "fulfilled" ? circle.value.length : null,
    skillsCount: skills.status === "fulfilled" ? skills.value.length : null,
  };
}

/** Training Score: age + cognition invested + skills. Capped at 1000. */
export function trainingScore(opts: {
  createdAt?: string | null;
  usage30d?: number | null;
  skillsCount?: number | null;
}): number {
  const ageDays = opts.createdAt
    ? Math.max(0, (Date.now() - new Date(opts.createdAt).getTime()) / 86_400_000)
    : 0;
  const score = ageDays * 8 + (opts.usage30d ?? 0) * 0.04 + (opts.skillsCount ?? 0) * 40;
  return Math.min(1000, Math.round(score));
}

/** Sum cognition usage between two instants (hourly buckets). */
export async function usageBetween(mindId: string, start: Date, end: Date): Promise<number> {
  const res = await minds().getCognitionUsage(mindId, {
    interval: "1h",
    startTime: start.toISOString(),
    endTime: end.toISOString(),
  });
  return res.items.reduce((s, i) => s + (i.value ?? 0), 0);
}
