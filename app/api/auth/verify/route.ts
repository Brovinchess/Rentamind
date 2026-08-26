import { NextResponse } from "next/server";
import { supaServer } from "@/lib/auth";

/** POST /api/auth/verify {email, token} — verifies the 6-digit code and sets the session cookies. */
export async function POST(req: Request) {
  try {
    const { email, token } = await req.json();
    const clean = String(email ?? "").trim().toLowerCase();
    const code = String(token ?? "").trim();
    if (!clean || !code) {
      return NextResponse.json({ error: "email and code required" }, { status: 400 });
    }
    const supa = await supaServer();
    const { data, error } = await supa.auth.verifyOtp({ email: clean, token: code, type: "email" });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Invalid code" }, { status: 401 });
    }
    return NextResponse.json({ ok: true, email: data.user.email });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "auth error" }, { status: 500 });
  }
}
