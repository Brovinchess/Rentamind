import { NextResponse } from "next/server";
import { supaServer } from "@/lib/auth";

export async function POST() {
  const supa = await supaServer();
  await supa.auth.signOut();
  return NextResponse.json({ ok: true });
}
