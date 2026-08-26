import { NextResponse } from "next/server";
import { parseBuilderKey } from "@/lib/auth";
import { db } from "@/lib/db";
import { mindsFor } from "@/lib/minds";
import { encryptKey, SESSION_COOKIE, signSession } from "@/lib/session";

/**
 * POST /api/auth/login {builderKey}
 * The Builder API key IS the identity: we parse email+humanId from it, verify
 * it works against the live Builder API, store it encrypted, and set a session.
 */
export async function POST(req: Request) {
  try {
    const { builderKey } = await req.json();
    const key = String(builderKey ?? "").trim();
    const parsed = parseBuilderKey(key);
    if (!parsed) {
      return NextResponse.json(
        { error: "That doesn't look like a Builder API key — copy it from the HelloMinds Builder console." },
        { status: 400 },
      );
    }

    // Prove the key actually works (and is not revoked/expired).
    let mindCount = 0;
    try {
      const minds = await mindsFor(key).listMinds({ humanId: parsed.humanId });
      mindCount = minds.length;
    } catch {
      return NextResponse.json(
        { error: "HelloMinds rejected this key — it may be expired or revoked. Create a fresh Builder API key and try again." },
        { status: 401 },
      );
    }

    const { error } = await db().from("ram_users").upsert(
      {
        human_id: parsed.humanId,
        email: parsed.email,
        builder_key: encryptKey(key),
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "human_id" },
    );
    if (error) throw new Error(error.message);

    const res = NextResponse.json({ ok: true, email: parsed.email, mindCount });
    res.cookies.set(SESSION_COOKIE, signSession(parsed), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "login error" }, { status: 500 });
  }
}
