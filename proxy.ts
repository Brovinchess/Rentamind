import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const TRAINER_EMAIL = (process.env.MINDS_STEWARD_EMAIL ?? "rovin@anichess.com").toLowerCase();

/** Routes anyone can see (browsing is open; acting requires login). */
function isOpen(pathname: string, method: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/marketplace" ||
    pathname.startsWith("/mind/") ||
    pathname === "/rewards" ||
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/api/auth/") ||
    (pathname === "/api/settle" && method === "GET") || // cron, self-authenticated
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  );
}

/** Routes only the trainer account may use. */
function isTrainerOnly(pathname: string, method: string): boolean {
  return (
    pathname === "/my-minds" ||
    pathname === "/studio" ||
    pathname === "/launch" ||
    pathname.startsWith("/talk/") ||
    pathname.startsWith("/api/listings") ||
    pathname.startsWith("/api/studio") ||
    pathname.startsWith("/api/minds") ||
    (pathname === "/api/settle" && method === "POST")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (isOpen(pathname, method)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? null;

  const withCookies = (res: NextResponse) => {
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!email) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return withCookies(NextResponse.redirect(loginUrl));
  }

  if (isTrainerOnly(pathname, method) && email !== TRAINER_EMAIL) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Trainer account required" }, { status: 403 });
    }
    return withCookies(NextResponse.redirect(new URL("/profile?trainer=required", request.url)));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
