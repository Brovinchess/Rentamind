"use client";

import { OAUTH_AUTH_URL, OAUTH_CALLBACK_PATH, OAUTH_CLIENT_ID, OAUTH_SCOPES } from "./oauth-config";

/**
 * The browser's only job is the redirect dance: send the user to HelloMinds,
 * come back, and hand the tokens to our server. It keeps nothing.
 *
 * The SDK is loaded with a dynamic import because it touches `window`, and
 * Next pre-renders client components on the server.
 *
 * Tokens are held in an in-memory store instead of the SDK's default
 * localStorage, for two reasons:
 *   1. Our server owns the refresh token (lib/oauth.ts). Refresh tokens rotate,
 *      so a second copy in the browser that ever refreshed would kill the
 *      server's — and with it every study cycle and rental for this user.
 *   2. localStorage is readable by any script on the page (the SDK README
 *      says as much). Nothing needs to be there.
 */
async function createOAuth() {
  if (!OAUTH_CLIENT_ID) {
    throw new Error("HelloMinds sign-in isn't configured (NEXT_PUBLIC_MINDS_OAUTH_CLIENT_ID is missing).");
  }
  const { MindsOAuth, TokenStore } = await import("@animocabrands/minds-connect");
  type Session = Parameters<InstanceType<typeof TokenStore>["set"]>[0];

  class MemoryTokenStore extends TokenStore {
    private session: Session | null = null;
    get() {
      return this.session;
    }
    set(session: Session) {
      this.session = session;
    }
    clear() {
      this.session = null;
    }
  }

  return new MindsOAuth({
    clientId: OAUTH_CLIENT_ID,
    // Must match the registered redirect exactly — and localhost vs 127.0.0.1
    // are different origins, so we always use whatever origin we're on.
    redirectUri: `${window.location.origin}${OAUTH_CALLBACK_PATH}`,
    scopes: [...OAUTH_SCOPES],
    authUrl: OAUTH_AUTH_URL,
    storage: new MemoryTokenStore(OAUTH_CLIENT_ID),
  });
}

/** Only same-site paths — never let `next` bounce the user off-site. */
export function safeNext(next: unknown, fallback = "/my-minds"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Go to HelloMinds to sign in and consent. Resolves only if navigation fails. */
export async function startConnect(next: string) {
  const oauth = await createOAuth();
  await oauth.signIn({ state: { next: safeNext(next) } });
}

/**
 * On the callback page: finish the exchange, then give the tokens to our
 * server, which verifies them, stores them, and sets the website session.
 */
export async function finishConnect(): Promise<{ next: string; email: string }> {
  const oauth = await createOAuth();
  const { tokens, state } = await oauth.handleRedirect();

  const res = await fetch("/api/auth/oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokens),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Sign-in failed (${res.status})`);

  const next = typeof state === "object" && state !== null ? (state as { next?: unknown }).next : undefined;
  return { next: safeNext(next), email: String(body.email ?? "") };
}
