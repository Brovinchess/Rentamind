import { NextResponse } from "next/server";

/** POST /api/gate {code} — sets the access cookie when the code matches. */
export async function POST(req: Request) {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) return NextResponse.json({ ok: true }); // gate disabled

  const { code } = await req.json().catch(() => ({ code: "" }));
  if (typeof code !== "string" || code.trim() !== expected) {
    return NextResponse.json({ error: "Wrong access code" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("ram_access", expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
