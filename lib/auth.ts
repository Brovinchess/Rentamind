import { cookies } from "next/headers";
import { createMindsClient, type MindsClient } from "@animocabrands/minds-client-lib";
import { db } from "./db";
import { decryptKey, SESSION_COOKIE, verifySession, type Session } from "./session";

/**
 * Builder-key auth: every user signs in with their own HelloMinds Builder API
 * key. The key is the identity (its JWT carries email + humanId); we store it
 * encrypted and scope every Minds operation to the signed-in user's key.
 */

export type AuthedUser = Session & { builderKey: string };

/** Parse email + humanId out of a Builder API key (a JWT). */
export function parseBuilderKey(key: string): Session | null {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    if (!payload.email || !payload.humanId) return null;
    return { email: String(payload.email).toLowerCase(), humanId: String(payload.humanId) };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function getSessionEmail(): Promise<string | null> {
  return (await getSession())?.email ?? null;
}

/** Full authed user incl. their decrypted Builder key (server-side only). */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await getSession();
  if (!session) return null;
  const { data } = await db().from("ram_users").select("builder_key").eq("human_id", session.humanId).maybeSingle();
  if (!data?.builder_key) return null;
  try {
    return { ...session, builderKey: decryptKey(data.builder_key) };
  } catch {
    return null;
  }
}

/** A Minds client scoped to the signed-in user. */
export async function getSessionMinds(): Promise<{ user: AuthedUser; client: MindsClient } | null> {
  const user = await getAuthedUser();
  if (!user) return null;
  return { user, client: createMindsClient({ builderApiKey: user.builderKey }) };
}

/** Look up any user's decrypted key by email (scheduler use). */
export async function getBuilderKeyForEmail(email: string): Promise<string | null> {
  const { data } = await db().from("ram_users").select("builder_key").eq("email", email.toLowerCase()).maybeSingle();
  if (!data?.builder_key) return null;
  try {
    return decryptKey(data.builder_key);
  } catch {
    return null;
  }
}
