// Registers the env Builder key's owner as a ram_users row (encrypted at rest).
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes, scryptSync } from "crypto";

const key = process.env.MINDS_BUILDER_API_KEY;
const secret = process.env.SESSION_SECRET;
const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
const encKey = scryptSync(secret, "ram-key-enc-v1", 32);
const iv = randomBytes(12);
const cipher = createCipheriv("aes-256-gcm", encKey, iv);
const enc = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
const stored = `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { error } = await db.from("ram_users").upsert({
  human_id: payload.humanId,
  email: payload.email.toLowerCase(),
  builder_key: stored,
}, { onConflict: "human_id" });
if (error) throw error;
console.log("seeded user:", payload.email, payload.humanId);
