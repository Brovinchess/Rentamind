import { NextResponse } from "next/server";
import { settle } from "@/lib/points";

export const maxDuration = 120;

async function run() {
  try {
    const result = await settle();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "settle error" }, { status: 500 });
  }
}

/** Manual trigger from the dashboard button (behind the access gate). */
export async function POST() {
  return run();
}

/** Vercel Cron trigger — authenticates itself with CRON_SECRET, bypassing the access gate. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}
