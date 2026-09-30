import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { completeLogin, disconnect, OAuthError } from "@/lib/oauth";
import { SESSION_COOKIE, signSession } from "@/lib/session";

/**
 * POST /api/auth/oauth  {accessToken, refreshToken, expiresIn, scope}
 *
 * The browser finished the HelloMinds PKCE redirect and hands us the tokens.
 * We prove they're genuine with a live Builder call, store them encrypted, and
 * start the website session. From here on the server alone refreshes them.
 *
 * Posting tokens here grants nothing a caller didn't already have: identity is
 * read from the token itself, and only after HelloMinds accepts that token.
 */
export async function POST(req: Request) {
  try {
    const tokens = await req.json().catch(() => null);
    const { humanId, email } = await completeLogin(tokens);

    const res = NextResponse.json({ ok: true, email });
    res.cookies.set(SESSION_COOKIE, signSession({ humanId, email }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (e) {
    const status = e instanceof OAuthError && e.status ? e.status : 400;
    console.error("[oauth] login failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign-in failed" },
      { status: status >= 400 && status < 600 ? status : 400 },
    );
  }
}

/**
 * DELETE /api/auth/oauth — disconnect from HelloMinds.
 *
 * Revokes our refresh token and forgets the session, which STOPS this user's
 * Minds studying and being rented. That's deliberately separate from signing
 * out (/api/auth/signout), which only ends the browser session.
 */
export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await disconnect(session.humanId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
  return res;
}
