import { NextResponse } from "next/server";
import { settle } from "@/lib/points";

export const maxDuration = 120;

/** Demo stand-in for the rental cron: expire ended rentals, meter usage, award Synapses. */
export async function POST() {
  try {
    const result = await settle();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "settle error" }, { status: 500 });
  }
}
