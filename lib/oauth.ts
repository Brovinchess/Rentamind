import { createMindsClient, parseUserIdFromAccessToken } from "@animocabrands/minds-client-lib";
import { db } from "./db";
import { OAUTH_AUTH_URL, OAUTH_CLIENT_ID } from "./oauth-config";
import { decryptKey, encryptKey } from "./session";

/**
 * Server-side owner of every user's HelloMinds OAuth session (a "BFF").
 *
 * Why the server and not the browser: the minds-connect SDK assumes the page
 * keeps the token fresh, but this app does most of its work while the owner is
 * gone — the study loop sends directives every few hours, and renters chat
 * through the owner's Mind. So the refresh token lives here, encrypted, and the
 * browser never keeps a copy (see lib/oauth-browser.ts).
 *
 * Refresh tokens ROTATE on every use. If two processes refresh the same token
 * at once, one of them holds a dead token — and Auth may treat the reuse as
 * theft and revoke the whole session. So refreshes are serialised twice over:
 * an in-process promise per user, and a short DB lease across instances.
 */

/** Refresh when this close to expiry — a study pass can run ~45s. */
const REFRESH_MARGIN_MS = 2 * 60_000;
const LEASE_MS = 30_000;
const TOKEN_TIMEOUT_MS = 15_000;

export type TokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

type Row = {
  human_id: string;
  email: string;
  oauth_user_id: string | null;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: string | null;
  oauth_scope: string | null;
};

const COLS =
  "human_id,email,oauth_user_id,oauth_access_token,oauth_refresh_token,oauth_expires_at,oauth_scope";

export class OAuthError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "OAuthError";
  }
  /** Auth has disowned this refresh token — it will never work again. */
  get isTerminal() {
    return this.status === 400 || this.status === 401 || this.status === 403;
  }
}

/* ───────────────────────────── wire calls ───────────────────────────── */

/** Same request and validation as the SDK's `requestTokens` (minds-connect 0.1.2). */
async function postToken(body: Record<string, string>): Promise<TokenSet> {
  let res: Response;
  try {
    res = await fetch(new URL("/v2/oauth/token", OAUTH_AUTH_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch (e) {
    throw new OAuthError(e instanceof Error ? e.message : "token request failed");
  }
  const json = (await res.json().catch(() => ({}))) as Partial<TokenSet>;
  if (!res.ok) throw new OAuthError(`token request failed (${res.status})`, res.status, json);
  return validateTokens(json);
}

export function validateTokens(t: Partial<TokenSet> | null | undefined): TokenSet {
  const expiresIn = Number(t?.expiresIn);
  if (!t?.accessToken || !t.refreshToken || !t.scope || !Number.isFinite(expiresIn)) {
    throw new OAuthError("Invalid token response");
  }
  return {
    accessToken: String(t.accessToken),
    refreshToken: String(t.refreshToken),
    expiresIn,
    scope: String(t.scope),
  };
}

function refreshTokens(refreshToken: string) {
  return postToken({ grant_type: "refresh_token", client_id: OAUTH_CLIENT_ID, refresh_token: refreshToken });
}

/** Best-effort, like the SDK's `signOut`: a failed revoke still disconnects locally. */
async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch(new URL("/v2/oauth/revoke", OAUTH_AUTH_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: refreshToken, client_id: OAUTH_CLIENT_ID }),
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    /* best effort */
  }
}

/* ───────────────────────────── identity ───────────────────────────── */

function jwtPayload(token: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
  } catch {
    return {};
  }
}

export type OAuthIdentity = { userId: string; email: string | null };

export function identityFromAccessToken(accessToken: string): OAuthIdentity | null {
  const userId = parseUserIdFromAccessToken(accessToken);
  if (!userId) return null;
  const email = jwtPayload(accessToken).email;
  return { userId, email: typeof email === "string" && email.includes("@") ? email.toLowerCase() : null };
}

/* ───────────────────────────── login ───────────────────────────── */

/**
 * Which existing account owns these Minds, according to our own records?
 *
 * This is how a trainer from the Builder-key era is recognised. HelloMinds
 * doesn't offer partner apps the `email` scope, and the OAuth user id is a
 * different namespace from the Builder key's humanId — so neither can be
 * matched directly. But a token can only list its OWNER's Minds, and our
 * training plans and listings record which account each Mind belongs to. So
 * "this token owns Mind X, and our records say Mind X is rovin's" is proof
 * HelloMinds itself vouches for.
 *
 * Only a single, unambiguous owner is accepted.
 */
async function accountOwningMinds(mindIds: string[]): Promise<string | null> {
  if (!mindIds.length) return null;
  const [plans, listings] = await Promise.all([
    db().from("ram_training_plans").select("owner_email").in("mind_id", mindIds),
    db().from("ram_listings").select("steward_email").in("mind_id", mindIds),
  ]);
  const owners = new Set<string>();
  for (const r of plans.data ?? []) if (r.owner_email) owners.add(String(r.owner_email).toLowerCase());
  for (const r of listings.data ?? []) if (r.steward_email) owners.add(String(r.steward_email).toLowerCase());
  return owners.size === 1 ? [...owners][0] : null;
}

/**
 * Stand-in key for an account HelloMinds gave us no email for. `.invalid` is
 * reserved (RFC 2606) so nothing can ever be delivered to it. Our tables are
 * keyed by email, so every account needs one.
 */
const placeholderEmail = (userId: string) => `hm-${userId}@oauth.invalid`;

/**
 * Finish a login: prove the tokens are genuine, work out who this is, and
 * store the session. Returns the row our session cookie should point at.
 *
 * Matching order: OAuth user id (returning user) → email claim, if HelloMinds
 * ever includes one → ownership of Minds already on an account → new account.
 * Existing trainers keep their human_id, and with it every listing, plan,
 * rental and point on their account.
 */
export async function completeLogin(raw: unknown): Promise<{ humanId: string; email: string }> {
  if (!OAUTH_CLIENT_ID) throw new OAuthError("OAuth is not configured on this server");
  const tokens = validateTokens(raw as Partial<TokenSet>);

  const identity = identityFromAccessToken(tokens.accessToken);
  if (!identity) throw new OAuthError("HelloMinds returned a token without a user id");

  // A token we merely decoded proves nothing. One real call does: Builder
  // rejects anything forged or revoked, so the claims we just read are genuine.
  // The same call gives us the Minds we use to recognise existing accounts.
  let mindIds: string[];
  try {
    const minds = await createMindsClient({ accessToken: tokens.accessToken }).listMinds();
    mindIds = minds.map((m) => m.mindId).filter(Boolean);
  } catch (e) {
    throw new OAuthError(
      `HelloMinds rejected the new session: ${e instanceof Error ? e.message : String(e)}`,
      401,
    );
  }

  const encrypted = {
    oauth_user_id: identity.userId,
    oauth_access_token: encryptKey(tokens.accessToken),
    oauth_refresh_token: encryptKey(tokens.refreshToken),
    oauth_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    oauth_scope: tokens.scope,
    oauth_refresh_lock_until: null,
    oauth_connected_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
  };

  const adopt = async (row: Row, how: string) => {
    const { error } = await db().from("ram_users").update(encrypted).eq("human_id", row.human_id);
    if (error) throw new OAuthError(`could not save session: ${error.message}`);
    console.info(`[oauth] login ${identity.userId} -> ${row.email} (${how})`);
    return { humanId: row.human_id, email: row.email };
  };

  // 1. Returning user.
  const byId = await db().from("ram_users").select(COLS).eq("oauth_user_id", identity.userId).maybeSingle();
  if (byId.data) return adopt(byId.data as Row, "oauth user id");

  // 2. An email claim, should HelloMinds ever include one.
  if (identity.email) {
    const byEmail = await db().from("ram_users").select(COLS).eq("email", identity.email).maybeSingle();
    if (byEmail.data) return adopt(byEmail.data as Row, "email claim");
  }

  // 3. A Builder-key-era trainer, recognised by the Minds they own.
  const ownerEmail = await accountOwningMinds(mindIds);
  if (ownerEmail) {
    const byOwner = await db()
      .from("ram_users")
      .select(COLS)
      .eq("email", ownerEmail)
      .is("oauth_user_id", null) // never steal an account another HelloMinds user already claimed
      .maybeSingle();
    if (byOwner.data) return adopt(byOwner.data as Row, `owns ${mindIds.length} Minds on record`);
  }

  // 4. Brand new.
  const email = identity.email ?? placeholderEmail(identity.userId);
  const { error } = await db().from("ram_users").insert({ human_id: identity.userId, email, ...encrypted });
  if (error) throw new OAuthError(`could not create account: ${error.message}`);
  console.info(`[oauth] login ${identity.userId} -> new account ${email}`);
  return { humanId: identity.userId, email };
}

/* ───────────────────────────── access tokens ───────────────────────────── */

async function readRow(humanId: string): Promise<Row | null> {
  const { data } = await db().from("ram_users").select(COLS).eq("human_id", humanId).maybeSingle();
  return (data as Row) ?? null;
}

function freshAccess(row: Row | null): string | null {
  if (!row?.oauth_access_token || !row.oauth_expires_at) return null;
  if (new Date(row.oauth_expires_at).getTime() - Date.now() <= REFRESH_MARGIN_MS) return null;
  try {
    return decryptKey(row.oauth_access_token);
  } catch {
    return null;
  }
}

/** Still usable right now, even if inside the refresh margin. */
function notYetExpired(row: Row | null): string | null {
  if (!row?.oauth_access_token || !row.oauth_expires_at) return null;
  if (new Date(row.oauth_expires_at).getTime() <= Date.now()) return null;
  try {
    return decryptKey(row.oauth_access_token);
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const inflight = new Map<string, Promise<string | null>>();

/**
 * A usable HelloMinds access token for this user, refreshing if needed.
 * `null` means they aren't connected (or HelloMinds revoked the session) and
 * must connect again — callers should treat that as "this Mind is offline".
 */
export function getAccessTokenForHuman(humanId: string): Promise<string | null> {
  const pending = inflight.get(humanId);
  if (pending) return pending;
  const p = resolveAccessToken(humanId).finally(() => inflight.delete(humanId));
  inflight.set(humanId, p);
  return p;
}

async function resolveAccessToken(humanId: string): Promise<string | null> {
  const row = await readRow(humanId);
  if (!row?.oauth_refresh_token) return null;
  const fresh = freshAccess(row);
  if (fresh) return fresh;

  // Take the refresh lease. Only one instance may rotate the token.
  const now = new Date();
  const { data: won } = await db()
    .from("ram_users")
    .update({ oauth_refresh_lock_until: new Date(now.getTime() + LEASE_MS).toISOString() })
    .eq("human_id", humanId)
    .or(`oauth_refresh_lock_until.is.null,oauth_refresh_lock_until.lt."${now.toISOString()}"`)
    .select("human_id");

  if (!won?.length) {
    // Someone else is refreshing. Wait for their result rather than racing.
    for (let i = 0; i < 24; i++) {
      await sleep(500);
      const again = await readRow(humanId);
      const token = freshAccess(again);
      if (token) return token;
      if (!again?.oauth_refresh_token) return null;
    }
    return notYetExpired(await readRow(humanId));
  }

  try {
    // Re-read under the lease: another instance may have just finished.
    const current = await readRow(humanId);
    const already = freshAccess(current);
    if (already) {
      await db().from("ram_users").update({ oauth_refresh_lock_until: null }).eq("human_id", humanId);
      return already;
    }
    if (!current?.oauth_refresh_token) return null;

    const tokens = await refreshTokens(decryptKey(current.oauth_refresh_token));
    await db()
      .from("ram_users")
      .update({
        oauth_access_token: encryptKey(tokens.accessToken),
        oauth_refresh_token: encryptKey(tokens.refreshToken),
        oauth_expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        oauth_scope: tokens.scope,
        oauth_refresh_lock_until: null,
      })
      .eq("human_id", humanId);
    console.info(`[oauth] refreshed ${humanId} (pid ${process.pid}), next in ${Math.round(tokens.expiresIn / 60)}m`);
    return tokens.accessToken;
  } catch (e) {
    if (e instanceof OAuthError && e.isTerminal) {
      // Revoked, expired, or reused. Stop hammering Auth; the user must reconnect.
      console.error("[oauth] refresh rejected for", humanId, e.status, e.body);
      await clearSession(humanId);
      return null;
    }
    // Transient (network / 5xx): release the lease and limp on the old token.
    console.error("[oauth] refresh failed for", humanId, e instanceof Error ? e.message : e);
    await db().from("ram_users").update({ oauth_refresh_lock_until: null }).eq("human_id", humanId);
    return notYetExpired(await readRow(humanId));
  }
}

async function clearSession(humanId: string) {
  await db()
    .from("ram_users")
    .update({
      oauth_access_token: null,
      oauth_refresh_token: null,
      oauth_expires_at: null,
      oauth_refresh_lock_until: null,
    })
    .eq("human_id", humanId);
}

/**
 * Fully disconnect: revoke at HelloMinds and forget the tokens. This STOPS the
 * user's Minds training and being rented — unlike signing out of the website,
 * which only ends the browser session.
 */
export async function disconnect(humanId: string): Promise<void> {
  const row = await readRow(humanId);
  if (row?.oauth_refresh_token) {
    try {
      await revokeRefreshToken(decryptKey(row.oauth_refresh_token));
    } catch {
      /* undecryptable — forget it anyway */
    }
  }
  await clearSession(humanId);
}

/**
 * When the user must connect again. HelloMinds refresh tokens last 30 days
 * from the ORIGINAL sign-in and refreshing does not extend them (verified: a
 * token refreshed at 03:20 still expired at the first login's 03:18 + 30d).
 * So no amount of background refreshing keeps a user connected past this.
 */
function sessionExpiry(row: Row | null): Date | null {
  if (!row?.oauth_refresh_token) return null;
  try {
    const exp = jwtPayload(decryptKey(row.oauth_refresh_token)).exp;
    return typeof exp === "number" ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

/** Warn this many days before the 30-day connection runs out. */
export const RECONNECT_WARNING_DAYS = 7;

/** For the profile page and My Minds: connected, until when, and which scopes. */
export async function connectionStatus(humanId: string) {
  const row = await readRow(humanId);
  const expiresAt = sessionExpiry(row);
  const daysLeft = expiresAt ? (expiresAt.getTime() - Date.now()) / 86_400_000 : null;
  return {
    connected: !!row?.oauth_refresh_token,
    scopes: (row?.oauth_scope ?? "").split(/\s+/).filter(Boolean),
    expiresAt,
    daysLeft,
    expiringSoon: daysLeft != null && daysLeft < RECONNECT_WARNING_DAYS,
  };
}
