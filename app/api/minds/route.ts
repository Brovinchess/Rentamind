import { NextResponse } from "next/server";
import { minds } from "@/lib/minds";

/** GET /api/minds — uncached live list, used by the launch flow to detect a newly awakened Mind. */
export async function GET() {
  try {
    const items = await minds().listMinds();
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
