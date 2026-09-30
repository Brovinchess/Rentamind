/**
 * HelloMinds OAuth (minds-connect) configuration shared by browser and server.
 *
 * Import-free on purpose: the browser imports this next to
 * `@animocabrands/minds-connect`, and the server must not pull that package in
 * (it touches `window`), so neither side can depend on the other.
 */

/** Public by design — the OAuth client is a PKCE public client with no secret. */
export const OAUTH_CLIENT_ID = process.env.NEXT_PUBLIC_MINDS_OAUTH_CLIENT_ID ?? "";

/** Auth API. Only override for HelloMinds staging / a local Auth API. */
export const OAUTH_AUTH_URL =
  process.env.NEXT_PUBLIC_MINDS_OAUTH_AUTH_URL || "https://api.oauth.hellominds.ai";

/** Must be registered on the OAuth client, character for character. */
export const OAUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Every scope the app uses, requested once at sign-in.
 *
 * Not incremental on purpose: training and rentals run on our server while the
 * owner is away (the study loop sends directives; renters chat through the
 * owner's Mind), so there is no moment to ask for more consent later.
 *
 * Each of these must also be enabled on the OAuth client in the Build console —
 * Auth rejects the whole login if any requested scope isn't allowed.
 * Values are the OAuth wire ids, identical to `MindsScope.*`.
 */
export const OAUTH_SCOPES = [
  // NOT "email": it's in the SDK's scope catalog but HelloMinds doesn't offer it
  // to partner clients — requesting it fails every login with
  // "Scope not available to this client: email" (verified Sep 30, 2026).
  // Identity comes from the token's `sub` plus Mind ownership; see lib/oauth.ts.
  "minds:list", //               My Minds, launch detection, and identity proof
  "minds:status", //             online / paused
  "minds:cognition", //          balances, usage, runway, rental allowance
  "minds:skills:list", //        Bazaar: what a Mind already has
  "minds:skills:equip", //       Bazaar
  "minds:skills:unequip", //     Bazaar
  "minds:apps:list", //          Studio: check the research app
  "minds:apps:equip", //         Studio: equip the research app
  "conversations:create", //     training room + per-rental private chats
  "conversations:list",
  "conversations:read",
  "messaging:send", //           study directives + rental messages
  "messaging:history", //        transcripts + study replies
  "messaging:stream", //         real-time replies (SSE)
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const oauthConfigured = () => OAUTH_CLIENT_ID.length > 0;
