import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "ram_session";

/** Routes anyone can see; acting requires signing in with a Builder key. */
function isOpen(pathname: string, method: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/marketplace" ||
    pathname.startsWith("/mind/") ||
    pathname === "/rewards" ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    (pathname === "/api/settle" && method === "GET") || // cron, self-authenticated
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

/** Verify the HMAC session cookie with WebCrypto (works in any runtime). */
async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const expected = Buffer.from(sig).toString("base64url");
    if (expected !== mac) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof data.x === "number" && data.x > Date.now() && !!data.h && !!data.e;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isOpen(pathname, request.method)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.next(); // auth disabled without a secret (dev safety)

  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
