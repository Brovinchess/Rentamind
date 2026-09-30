import { NextResponse } from "next/server";
import { getSessionEmail } from "@/lib/auth";
import { checkMindName, getSpeciesItems } from "@/lib/core-api";

/**
 * Launch helpers, backed by the HelloMinds **Core API**'s public endpoints —
 * no key of any kind is needed for either of these upstream calls, but we still
 * gate them on a session so this isn't a free name-enumeration proxy.
 *
 *   GET /api/launch?name=foo            -> { available: boolean | null }
 *   GET /api/launch?parentCategory=x    -> { roles: [...] }
 *   GET /api/launch                     -> { roles: [top-level roles] }
 */
export async function GET(req: Request) {
  if (!(await getSessionEmail())) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }
  const url = new URL(req.url);
  const name = url.searchParams.get("name");

  if (name != null) {
    return NextResponse.json({ available: await checkMindName(name) });
  }

  const parentCategory = url.searchParams.get("parentCategory") ?? undefined;
  const items = await getSpeciesItems({ parentCategory });
  return NextResponse.json({
    roles: items.map((i) => ({
      category: i.category,
      title: i.title,
      // `dna` is sometimes an entire system prompt; `description` is the blurb.
      description: i.description,
      hasChildren: i.hasChildren,
    })),
  });
}
