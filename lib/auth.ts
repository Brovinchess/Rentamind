import { cookies } from "next/headers";
import { createMindsClient, type MindsClient } from "@animocabrands/minds-client-lib";
import { db } from "./db";
import { getAccessTokenForHuman } from "./oauth";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

/**
 * Sign-in is "Connect with HelloMinds" (OAuth 2.1 + PKCE via minds-connect).
 *
 * Two separate things, on purpose:
 *   • the website session — our HMAC cookie, `{humanId, email}`
 *   • the HelloMinds session — OAuth tokens held server-side in lib/oauth.ts
 *
 * Every Minds call is made with the signed-in user's own fresh access token,
 * so nothing here can act beyond what that user consented to.
 */

/** `accessToken` is always a currently-valid HelloMinds OAuth token. */
export type AuthedUser = Session & { accessToken: string };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function getSessionEmail(): Promise<string | null> {
  return (await getSession())?.email ?? null;
}

/**
 * The signed-in user plus a usable access token. `null` when signed out, or
 * when their HelloMinds connection has lapsed and they need to connect again.
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session) return null;
  const accessToken = await getAccessTokenForHuman(session.humanId);
  if (!accessToken) return null;
  return { ...session, accessToken };
}

/** A Minds client scoped to the signed-in user. */
export async function getSessionMinds(): Promise<{ user: AuthedUser; client: MindsClient } | null> {
  const user = await getAuthedUser();
  if (!user) return null;
  return { user, client: createMindsClient({ accessToken: user.accessToken }) };
}

/**
 * Any user's access token by email — for work done while they're away: the
 * study scheduler, renters chatting with their Mind, marketplace stats.
 * `null` if they aren't connected; treat their Minds as offline.
 */
export async function getAccessTokenForEmail(email: string): Promise<string | null> {
  const { data } = await db().from("ram_users").select("human_id").eq("email", email.toLowerCase()).maybeSingle();
  if (!data?.human_id) return null;
  return getAccessTokenForHuman(String(data.human_id));
}
