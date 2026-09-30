import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { listBazaarSkills } from "@/lib/core-api";
import { listMindsFor, mindsFor } from "@/lib/minds";

/**
 * The Bazaar skill catalog, from the Core API's fully public
 * `GET /v1/bazaar/skills` (3,900+ skills, each with an `equippedCount`
 * popularity signal). Equipping happens with the signed-in user's own Builder
 * key, so we never act on a Mind that isn't theirs.
 *
 *   GET  /api/skills?q=&page=&mindId=  -> catalog page + what that Mind has
 *   POST /api/skills {mindId, skillId, equip}
 */
export async function GET(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? 1) || 1;
  const mindId = url.searchParams.get("mindId");

  const [catalog, equipped] = await Promise.all([
    listBazaarSkills({ search: q, page, pageSize: 12 }),
    mindId
      ? mindsFor(user.accessToken)
          .listEquippedSkills(mindId)
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ...catalog,
    equippedIds: equipped.map((s) => String(s.skillId).toLowerCase()),
  });
}

export async function POST(req: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  try {
    const { mindId, skillId, equip } = await req.json();
    const id = String(mindId ?? "");
    const skill = String(skillId ?? "");
    if (!id || !skill) return NextResponse.json({ error: "mindId and skillId required" }, { status: 400 });

    const owned = await listMindsFor(user.accessToken).catch(() => []);
    if (!owned.some((m) => m.mindId === id)) {
      return NextResponse.json({ error: "That's not one of your Minds." }, { status: 403 });
    }

    const c = mindsFor(user.accessToken);
    const result = equip
      ? await c.equipSkills(id, { ids: [skill] })
      : await c.unequipSkills(id, { ids: [skill] });

    return NextResponse.json({ ok: true, results: result.results });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "equip failed" }, { status: 500 });
  }
}
