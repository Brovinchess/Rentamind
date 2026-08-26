import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/request {email, inviteCode?}
 * Sends a 6-digit sign-in code. New accounts need the invite code (Season 0 is invite-gated).
 */
export async function POST(req: Request) {
  try {
    const { email, inviteCode, next } = await req.json();
    const clean = String(email ?? "").trim().toLowerCase();
    if (!/.+@.+\..+/.test(clean)) {
      return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
    }
    const origin = new URL(req.url).origin;
    const safeNext = typeof next === "string" && next.startsWith("/") ? next : "/profile";
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`;
    const supa = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );

    // Existing users sign in without an invite.
    const attempt = await supa.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: false, emailRedirectTo },
    });
    if (!attempt.error) return NextResponse.json({ sent: true });

    const msg = attempt.error.message.toLowerCase();
    const isNewUser = msg.includes("signup") || msg.includes("sign up") || msg.includes("not allowed");
    if (!isNewUser) {
      return NextResponse.json({ error: attempt.error.message }, { status: 400 });
    }

    // New account: require the invite code.
    const invite = process.env.APP_ACCESS_CODE;
    if (invite && String(inviteCode ?? "").trim() !== invite) {
      return NextResponse.json({ needsInvite: true, error: inviteCode ? "Wrong invite code" : undefined });
    }
    const created = await supa.auth.signInWithOtp({
      email: clean,
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (created.error) {
      return NextResponse.json({ error: created.error.message }, { status: 400 });
    }
    return NextResponse.json({ sent: true, created: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "auth error" }, { status: 500 });
  }
}
