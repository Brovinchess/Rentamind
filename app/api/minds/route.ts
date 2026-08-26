import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { listMindsFor } from "@/lib/minds";

/** GET /api/minds — the signed-in user's live Minds (uncached, for launch detection). */
export async function GET() {
  try {
    const user = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const items = await listMindsFor(user.builderKey);
    return NextResponse.json({
      minds: items.map((m) => ({
        mindId: m.mindId,
        name: m.name ?? "unnamed",
        isEnabled: !!m.isEnabled,
        createdAt: m.createdAt ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "minds error" }, { status: 500 });
  }
}
