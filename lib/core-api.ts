/**
 * HelloMinds **Core API** client (https://api.hellominds.ai).
 *
 * This is a third API surface, distinct from the Builder API we use everywhere
 * else. Most of it needs a HelloMinds *user session* JWT, which a Builder key is
 * not — a Builder key carries `role: "builder"` and the Core API rejects it with
 * `BAD_INPUT / VALIDATION_FAILED`. See docs/CORE-API-NOTES.md.
 *
 * So this module is split in two:
 *   • public()  — 18 endpoints that need no auth at all. Used in production.
 *   • session() — everything else, behind a session token we don't have yet.
 *                 Wired and typed so it lights up the day we can issue one.
 *
 * Every response shape below was captured from the live API, not guessed.
 */

const BASE = process.env.HELLOMINDS_CORE_API_URL ?? "https://api.hellominds.ai";
const TIMEOUT_MS = 10_000;

export type CoreError = { type: string; subType: string; message: string };

export class CoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: CoreError | null,
    message: string,
  ) {
    super(message);
    this.name = "CoreApiError";
  }
}

async function call<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      // Core errors look like { method, url, error: { type, subType, message } }.
      // Note it answers 400 for auth failures, not 401.
      const detail =
        parsed && typeof parsed === "object" && "error" in parsed
          ? ((parsed as { error: CoreError }).error ?? null)
          : null;
      throw new CoreApiError(res.status, detail, detail?.message ?? `core ${res.status}`);
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ────────────────────────── public (no auth) ────────────────────────── */

/** Anonymous projection of any Mind — verified to return exactly these 2 fields. */
export type PublicMind = { mindId: string; name: string };

/**
 * Look up a Mind by id with no credentials at all.
 * Used to confirm a listed Mind still exists and still has the name we show.
 * Returns null for unknown ids (the API answers 400, not 404, for those).
 */
export async function getPublicMind(mindId: string): Promise<PublicMind | null> {
  try {
    return await call<PublicMind>(`/v1/minds/${encodeURIComponent(mindId)}`);
  } catch {
    return null;
  }
}

/** Is this Mind name free? `null` when the check itself failed. */
/** HelloMinds names are short and alphanumeric-ish; anything else can't exist. */
const NAME_RE = /^[A-Za-z0-9._-]{1,64}$/;

export async function checkMindName(name: string): Promise<boolean | null> {
  const trimmed = name.trim();
  // Reject locally rather than forwarding junk to the upstream oracle.
  if (!NAME_RE.test(trimmed)) return null;
  try {
    const r = await call<{ isAvailable: boolean }>(
      `/v1/minds/check/name?name=${encodeURIComponent(trimmed)}`,
    );
    return !!r.isAvailable;
  } catch {
    return null;
  }
}

/** One node of the species taxonomy — the archetypes a Mind can be awakened as. */
export type SpeciesItem = {
  species: string;
  category: string;
  parentCategory: string | null;
  level: number;
  title: string;
  description: string;
  /** The archetype's "DNA" blurb — a plain-language description of the role. */
  dna: string;
  iconName: string | null;
  /** JSON-encoded string array, not an array. */
  equippedToolSlugs: string | null;
  hasChildren: boolean;
};

export const DEFAULT_SPECIES = "moca";

/**
 * Browse the species taxonomy. It's two levels deep: no argument returns the
 * five top-level roles, and `parentCategory` descends into one of them.
 * (`category` filters to a single node; only `parentCategory` drills down.)
 */
// The role taxonomy is effectively static, so one upstream call per node serves
// every visitor instead of one per page load.
const speciesCache = new Map<string, { at: number; items: SpeciesItem[] }>();
const SPECIES_TTL_MS = 30 * 60_000;

export async function getSpeciesItems(
  opts: { species?: string; parentCategory?: string } = {},
): Promise<SpeciesItem[]> {
  const species = opts.species ?? DEFAULT_SPECIES;
  const cacheKey = `${species}:${opts.parentCategory ?? ""}`;
  const hit = speciesCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SPECIES_TTL_MS) return hit.items;

  const qs = new URLSearchParams();
  if (opts.parentCategory) qs.set("parentCategory", opts.parentCategory);
  try {
    const r = await call<{ items?: SpeciesItem[] }>(
      `/v1/species/${encodeURIComponent(species)}/items?${qs}`,
    );
    const items = r.items ?? [];
    speciesCache.set(cacheKey, { at: Date.now(), items });
    return items;
  } catch {
    // Serve stale rather than an empty role picker if we've ever had it.
    return hit?.items ?? [];
  }
}

/** Parse the JSON-encoded `equippedToolSlugs` string into a real array. */
export function parseToolSlugs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export type BazaarPage<T> = { totalCount: number; page: number; pageSize: number; items: T[] };
export type BazaarSkillItem = {
  skillId: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  equippedCount: number;
};
export type BazaarToolItem = {
  toolSlug: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  equippedCount: number;
  pricePublic: number | null;
};
export type BazaarAppItem = {
  appId: string;
  appName: string;
  description: string | null;
  tier: string | null;
  approved: boolean;
  provider: string | null;
  version: string | null;
  toolCount: number;
  equippedCount: number;
};

const EMPTY = <T,>(): BazaarPage<T> => ({ totalCount: 0, page: 1, pageSize: 25, items: [] });

export async function listBazaarSkills(opts: { search?: string; page?: number; pageSize?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.search) qs.set("search", opts.search);
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
  try {
    return await call<BazaarPage<BazaarSkillItem>>(`/v1/bazaar/skills?${qs}`);
  } catch {
    return EMPTY<BazaarSkillItem>();
  }
}

export async function listBazaarTools(opts: { page?: number; pageSize?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
  try {
    return await call<BazaarPage<BazaarToolItem>>(`/v1/bazaar/tools?${qs}`);
  } catch {
    return EMPTY<BazaarToolItem>();
  }
}

export async function listBazaarApps(opts: { search?: string; page?: number; pageSize?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.search) qs.set("search", opts.search);
  if (opts.page) qs.set("page", String(opts.page));
  if (opts.pageSize) qs.set("pageSize", String(opts.pageSize));
  try {
    return await call<BazaarPage<BazaarAppItem>>(`/v1/bazaar/apps?${qs}`);
  } catch {
    return EMPTY<BazaarAppItem>();
  }
}

let statsCache: { at: number; value: { mindSkills: number; mindTools: number; apps: number } } | null = null;

export async function bazaarStats(): Promise<{ mindSkills: number; mindTools: number; apps: number } | null> {
  if (statsCache && Date.now() - statsCache.at < SPECIES_TTL_MS) return statsCache.value;
  try {
    const value = await call<{ mindSkills: number; mindTools: number; apps: number }>(`/v1/bazaar/stats`);
    statsCache = { at: Date.now(), value };
    return value;
  } catch {
    return statsCache?.value ?? null;
  }
}

/* ────────────────────────── payments (public) ────────────────────────── */

/**
 * Anonymous Stripe checkout to fund a specific Mind's cognition.
 *
 * Validation ladder confirmed live, in this order:
 *   email missing            -> "email is required"
 *   cadence "monthly"        -> "Only one-time payments are available"
 *   amountCents < 200        -> "amountCents must be at least 200"
 *   otherwise                -> upstream Ethoswarm "Bad Request"
 *
 * The last case is where every well-formed request currently lands: the wrapper
 * accepts it and Ethoswarm rejects it, most likely because the target Mind has
 * no payments configuration. We keep this implemented and honest — callers get
 * the upstream message rather than a fabricated success.
 */
export const CHECKOUT_MIN_CENTS = 200;
/**
 * Our own ceiling. HelloMinds documents a server-side maximum but doesn't
 * enforce a visible one — a 12-digit amount gets the same generic upstream
 * error as a valid one. Since a success here sends someone to a real Stripe
 * page, we refuse absurd amounts before they can get there.
 */
export const CHECKOUT_MAX_CENTS = 50_000; // $500

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: string; upstream: boolean };

export async function createMindCheckout(opts: {
  mindId: string;
  amountCents: number;
  email: string;
  successUrl?: string;
  cancelUrl?: string;
  /** Only an authenticated session may use "monthly". */
  cadence?: "oneTime" | "monthly";
  token?: string;
}): Promise<CheckoutResult> {
  if (!opts.token && (opts.cadence ?? "oneTime") !== "oneTime") {
    return { ok: false, reason: "Recurring top-ups need a HelloMinds session.", upstream: false };
  }
  if (!Number.isInteger(opts.amountCents) || opts.amountCents < CHECKOUT_MIN_CENTS) {
    return { ok: false, reason: `Minimum top-up is $${(CHECKOUT_MIN_CENTS / 100).toFixed(2)}.`, upstream: false };
  }
  if (opts.amountCents > CHECKOUT_MAX_CENTS) {
    return { ok: false, reason: `Maximum top-up is $${CHECKOUT_MAX_CENTS / 100}.`, upstream: false };
  }
  try {
    const r = await call<{ url: string }>(
      `/v1/payments/minds/${encodeURIComponent(opts.mindId)}/checkout`,
      {
        method: "POST",
        token: opts.token,
        body: {
          amountCents: opts.amountCents,
          cadence: opts.cadence ?? "oneTime",
          ...(opts.token ? {} : { email: opts.email }),
          ...(opts.successUrl ? { successUrl: opts.successUrl } : {}),
          ...(opts.cancelUrl ? { cancelUrl: opts.cancelUrl } : {}),
        },
      },
    );
    if (!r?.url) return { ok: false, reason: "Checkout returned no URL.", upstream: true };
    return { ok: true, url: r.url };
  } catch (e) {
    const err = e instanceof CoreApiError ? e : null;
    return {
      ok: false,
      reason: err?.detail?.message ?? (e instanceof Error ? e.message : "checkout failed"),
      upstream: err?.detail?.subType === "ETHOSWARM_API_FAILED",
    };
  }
}

/* ───────────────────── session-gated (not reachable yet) ───────────────────── */

/**
 * These need a HelloMinds user-session JWT from `POST /v1/auth/login`, which
 * takes Airkit tokens. Nothing calls them in production today; they exist so the
 * switch is a one-line change if we ever get a session.
 */

export type Runway = {
  mindId: string;
  status: "estimated" | "idle" | null;
  runwayDays: number | null;
  perDay: number | null;
  balance: number;
  windowDays: number;
};

export type ScheduleCycle = {
  executeAtUtc: string;
  origin: string | null;
  type: string | null;
  status: string | null;
  title: string | null;
  cycleId: string | null;
  estimated: boolean;
};

export type MindSchedule = {
  mindId: string;
  fromUtc: string;
  toUtc: string;
  cadence: { isEnabled: boolean; frequencySeconds: number | null; anchorUtc: string | null };
  cycles: ScheduleCycle[];
};

export const session = {
  /** Exchange Airkit tokens for a HelloMinds session. Needs an Airkit integration. */
  login: (idToken: string, accessToken: string) =>
    call<{ token?: string }>(`/v1/auth/login`, { method: "POST", body: { idToken, accessToken } }),

  /** Native runway. We currently compute the same numbers in lib/runway.ts. */
  runway: (token: string, mindId: string, windowDays?: number) =>
    call<Runway>(
      `/v1/minds/${encodeURIComponent(mindId)}/runway${windowDays ? `?windowDays=${windowDays}` : ""}`,
      { token },
    ),

  /** Native scheduled cognition cycles. */
  schedule: (token: string, mindId: string) =>
    call<MindSchedule>(`/v1/minds/${encodeURIComponent(mindId)}/schedule`, { token }),

  /** In-app awakening — the one thing nothing else can replace. */
  awaken: (token: string, id: string, mindName: string) =>
    call<unknown>(`/v1/minds/awaken`, { method: "POST", token, body: { id, mindName } }),
};

/** Awaken identifiers accepted by POST /v1/minds/awaken, from the Core API spec. */
export const AWAKEN_IDS = [
  "mastermind", "assistantcoach", "generalassistant", "sales", "bizz", "superiortrader",
  "gamedesigner", "emailmanager", "scrummaster", "fitnesscoach", "personalchef", "recruiter",
  "football", "decision", "content", "research", "productbuilder", "learningcoach", "followup",
  "gtm", "chiefofstaff", "organisational", "productivity", "lifeassistant",
] as const;
