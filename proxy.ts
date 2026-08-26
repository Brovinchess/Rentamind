import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "ram_access";

/** Access gate: the whole app requires the access code (QA finding C1).
 *  /gate and /api/gate stay open so visitors can enter the code. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const open =
    pathname === "/gate" ||
    pathname === "/api/gate" ||
    // Cron trigger authenticates itself with CRON_SECRET inside the route
    (pathname === "/api/settle" && request.method === "GET") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";
  if (open) return NextResponse.next();

  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) return NextResponse.next(); // gate disabled when no code configured

  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Access code required" }, { status: 401 });
  }
  const gateUrl = new URL("/gate", request.url);
  gateUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
