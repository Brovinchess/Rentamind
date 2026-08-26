import { NextResponse } from "next/server";
import { createTrainingPlan, createTrainingSession, getSessionsForPlan, getTrainingPlans } from "@/lib/db";
import { ARCHETYPES, buildSteps, type ArchetypeKey, type Brief } from "@/lib/curriculum";
import { listMindsCached } from "@/lib/minds";

/** GET /api/studio — plans with their latest session (for the studio home). */
export async function GET() {
  try {
    const plans = await getTrainingPlans();
    const withSessions = await Promise.all(
      plans.map(async (p) => {
        const sessions = await getSessionsForPlan(p.id).catch(() => []);
        return { ...p, sessions: sessions.slice(0, 5) };
      }),
    );
    return NextResponse.json({ plans: withSessions });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "studio error" }, { status: 500 });
  }
}

/** POST /api/studio — create a plan + its first session from a brief. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const archetype = body.archetype as ArchetypeKey;
    if (!ARCHETYPES[archetype]) {
      return NextResponse.json({ error: "Unknown archetype" }, { status: 400 });
    }
    const { mindId, personaName, who, tone, sources, judgeMindId } = body;
    if (!mindId || !personaName?.trim() || !who?.trim()) {
      return NextResponse.json({ error: "mindId, personaName, and who are required" }, { status: 400 });
    }
    if (!judgeMindId) {
      return NextResponse.json({ error: "Pick an Examiner Mind to grade the exam" }, { status: 400 });
    }
    if (judgeMindId === mindId) {
      return NextResponse.json({ error: "The Examiner must be a different Mind than the trainee" }, { status: 400 });
    }
    const owned = await listMindsCached();
    const trainee = owned.find((m) => m.mindId === mindId);
    const judge = owned.find((m) => m.mindId === judgeMindId);
    if (!trainee || !judge) {
      return NextResponse.json({ error: "Both Minds must be on your account" }, { status: 403 });
    }

    const brief: Brief = {
      personaName: String(personaName).trim().slice(0, 80),
      who: String(who).trim().slice(0, 2000),
      tone: String(tone ?? "").trim().slice(0, 500),
      sources: String(sources ?? "").slice(0, 6000),
      judgeMindId,
      judgeMindName: judge.name ?? "examiner",
    };

    const plan = await createTrainingPlan({
      mind_id: mindId,
      mind_name: trainee.name ?? "unnamed",
      archetype,
      persona_name: brief.personaName,
      brief: brief as unknown as Record<string, unknown>,
    });
    const session = await createTrainingSession({
      plan_id: plan.id,
      steps: buildSteps(archetype, brief),
    });

    return NextResponse.json({ planId: plan.id, sessionId: session.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "studio error" }, { status: 500 });
  }
}
