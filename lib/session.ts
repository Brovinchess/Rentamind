import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

/**
 * Session + secrets for Builder-key login.
 * - Session cookie: HMAC-signed payload {humanId, email, exp} — no server-side session store.
 * - Builder keys at rest: AES-256-GCM encrypted with a key derived from SESSION_SECRET.
 */

const COOKIE_NAME = "ram_session";
export const SESSION_COOKIE = COOKIE_NAME;
const THIRTY_DAYS = 30 * 24 * 3600 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

export type Session = { humanId: string; email: string };

export function signSession(s: Session): string {
  const payload = Buffer.from(
    JSON.stringify({ h: s.humanId, e: s.email, x: Date.now() + THIRTY_DAYS }),
  ).toString("base64url");
  const mac = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function verifySession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.x !== "number" || data.x < Date.now()) return null;
    if (!data.h || !data.e) return null;
    return { humanId: String(data.h), email: String(data.e).toLowerCase() };
  } catch {
    return null;
  }
}

/* ── builder-key encryption at rest ── */

function encKey(): Buffer {
  return scryptSync(secret(), "ram-key-enc-v1", 32);
}

export function encryptKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptKey(stored: string): string {
  const [v, ivB64, tagB64, dataB64] = stored.split(".");
  if (v !== "v1") throw new Error("unknown key format");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}
