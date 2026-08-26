import { createMindsClient, type BuilderMind, type MindsClient } from "@animocabrands/minds-client-lib";

/**
 * Per-user Minds clients. Every operation is scoped to a specific user's
 * Builder key — there is no global account anymore.
 */

const clients = new Map<string, MindsClient>();
export function mindsFor(builderKey: string): MindsClient {
  let c = clients.get(builderKey);
  if (!c) {
    c = createMindsClient({ builderApiKey: builderKey });
    clients.set(builderKey, c);
  }
  return c;
}

/** 60s mind-list cache per key (keyed by a stable prefix, not the whole secret). */
const listCache = new Map<string, { at: number; items: BuilderMind[] }>();
export async function listMindsFor(builderKey: string): Promise<BuilderMind[]> {
  const cacheKey = builderKey.slice(-24);
  const hit = listCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;
  const items = await mindsFor(builderKey).listMinds();
  listCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

export type LiveMindStats = {
  balance: number | null;
  usage30d: number | null;
  circleSize: number | null;
  skillsCount: number | null;
};

export async function getLiveMindStats(builderKey: string, mindId: string): Promise<LiveMindStats> {
  const c = mindsFor(builderKey);
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
